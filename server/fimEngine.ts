import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import chokidar, { FSWatcher } from 'chokidar';
import {
  Baseline,
  BaselineFileRecord,
  IntegrityEvent,
  HashLogEntry,
  BaselineVerificationResult,
  SelfIntegrityFile,
  IntegrityTrendPoint,
  DirectorySummary
} from './types';
import { getDB, saveDB, addAuditLog } from './db';

// SSE subscribers for real-time live events pushing
export type EventListener = (type: string, data: any) => void;
const eventListeners: Set<EventListener> = new Set();

export function subscribeToFIMEvents(listener: EventListener) {
  eventListeners.add(listener);
  return () => eventListeners.delete(listener);
}

export function broadcastFIMEvent(type: string, data: any) {
  for (const listener of eventListeners) {
    try {
      listener(type, data);
    } catch (err) {
      console.error('Error broadcasting FIM event:', err);
    }
  }
}

// Simple mutex to prevent concurrent scans from racing / duplicating events
let scanInProgress = false;
function withScanLock<T>(fn: () => T): T | null {
  if (scanInProgress) {
    console.warn('[FIMGuard] Scan already in progress — skipping overlapping run');
    return null;
  }
  scanInProgress = true;
  try {
    return fn();
  } finally {
    scanInProgress = false;
  }
}

/** Ensure a resolved path stays inside the allowed root (path traversal guard). */
export function resolveSafePath(rootDir: string, relativePath: string): string {
  const root = path.resolve(rootDir);
  const resolved = path.resolve(root, relativePath);
  const rel = path.relative(root, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Path traversal blocked: ${relativePath}`);
  }
  return resolved;
}

/**
 * Computes actual SHA-256 cryptographic hash of a file.
 */
export function calculateFileHash(filePath: string): { hash: string; size: number; mtime: string } | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) return null;

    // Stream hash to avoid loading large files entirely into memory
    const hash = crypto.createHash('sha256');
    const fd = fs.openSync(filePath, 'r');
    try {
      const buf = Buffer.alloc(64 * 1024);
      let bytesRead = 0;
      while ((bytesRead = fs.readSync(fd, buf, 0, buf.length, null)) > 0) {
        hash.update(buf.subarray(0, bytesRead));
      }
    } finally {
      fs.closeSync(fd);
    }
    return {
      hash: hash.digest('hex'),
      size: stat.size,
      mtime: stat.mtime.toISOString()
    };
  } catch (err) {
    console.error(`Error calculating hash for ${filePath}:`, err);
    return null;
  }
}

/**
 * Checks if a file is plain text to allow unified diffing.
 */
export function isTextFile(filePath: string, buffer?: Buffer): boolean {
  const textExtensions = [
    '.txt', '.json', '.conf', '.env', '.js', '.ts', '.tsx', '.jsx',
    '.html', '.css', '.md', '.yml', '.yaml', '.ini', '.sh', '.py',
    '.xml', '.sql', '.toml', '.cfg', '.properties'
  ];
  const ext = path.extname(filePath).toLowerCase();
  if (textExtensions.includes(ext)) return true;

  try {
    const buf = buffer || fs.readFileSync(filePath);
    // Check first 512 bytes for null byte (common binary marker)
    const checkLength = Math.min(buf.length, 512);
    for (let i = 0; i < checkLength; i++) {
      if (buf[i] === 0) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a relative or absolute path matches any active exclusion rules.
 */
export function isPathExcluded(targetRelativePath: string, exclusions = getDB().exclusions): boolean {
  const norm = targetRelativePath.replace(/\\/g, '/');
  for (const ex of exclusions) {
    if (!ex.enabled) continue;
    const pattern = ex.pattern.replace(/\\/g, '/');

    if (pattern.startsWith('**/') && pattern.endsWith('/**')) {
      const segment = pattern.slice(3, -3);
      if (norm.includes(`/${segment}/`) || norm.startsWith(`${segment}/`) || norm === segment) {
        return true;
      }
    } else if (pattern.startsWith('**/*.')) {
      const ext = pattern.slice(4); // e.g. .log
      if (norm.endsWith(ext)) return true;
    } else if (pattern.startsWith('**/')) {
      const term = pattern.slice(3);
      if (norm.endsWith(`/${term}`) || norm === term) return true;
    } else if (norm.includes(pattern)) {
      return true;
    }
  }
  return false;
}

/**
 * Traverses a target directory recursively and gathers valid file records.
 */
export function scanDirectoryFiles(rootDir: string): BaselineFileRecord[] {
  const records: BaselineFileRecord[] = [];
  if (!fs.existsSync(rootDir)) return records;

  function walk(currentDir: string) {
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');

        if (isPathExcluded(relPath)) {
          continue;
        }

        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile()) {
          const hashInfo = calculateFileHash(fullPath);
          if (hashInfo) {
            let contentSnapshot: string | undefined = undefined;
            const textCheck = isTextFile(fullPath);
            if (textCheck && hashInfo.size < 500 * 1024) { // Snapshot files < 500KB for text diffs
              try {
                contentSnapshot = fs.readFileSync(fullPath, 'utf-8');
              } catch (e) {
                // Ignore read errors
              }
            }

            records.push({
              path: fullPath,
              relativePath: relPath,
              hash: hashInfo.hash,
              size: hashInfo.size,
              mtime: hashInfo.mtime,
              isText: textCheck,
              contentSnapshot
            });
          }
        }
      }
    } catch (err) {
      console.error(`Error reading directory ${currentDir}:`, err);
    }
  }

  walk(rootDir);
  return records;
}

/**
 * Recursively scans directory structure returning both files and subdirectories.
 */
export function scanDirectoryStructure(rootDir: string): { files: BaselineFileRecord[]; directories: string[] } {
  const files: BaselineFileRecord[] = [];
  const directories: string[] = [''];
  if (!fs.existsSync(rootDir)) return { files, directories };

  function walk(currentDir: string) {
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');

        if (isPathExcluded(relPath)) {
          continue;
        }

        if (entry.isDirectory()) {
          directories.push(relPath);
          walk(fullPath);
        } else if (entry.isFile()) {
          const hashInfo = calculateFileHash(fullPath);
          if (hashInfo) {
            let contentSnapshot: string | undefined = undefined;
            const textCheck = isTextFile(fullPath);
            if (textCheck && hashInfo.size < 500 * 1024) {
              try {
                contentSnapshot = fs.readFileSync(fullPath, 'utf-8');
              } catch (e) {}
            }

            files.push({
              path: fullPath,
              relativePath: relPath,
              hash: hashInfo.hash,
              size: hashInfo.size,
              mtime: hashInfo.mtime,
              isText: textCheck,
              contentSnapshot
            });
          }
        }
      }
    } catch (err) {
      console.error(`Error reading directory ${currentDir}:`, err);
    }
  }

  walk(rootDir);
  return { files, directories: Array.from(new Set(directories)).sort() };
}

/**
 * Computes live directory-level metrics, mutation statistics, and integrity trends.
 */
export function computeIntegrityMetrics(trigger = 'SYSTEM_CHECK'): {
  totalFiles: number;
  totalFolders: number;
  matchedCount: number;
  modifiedCount: number;
  addedCount: number;
  deletedCount: number;
  integrityScore: number;
  directoryBreakdown: DirectorySummary[];
} {
  const db = getDB();
  const targetDir = db.config.targetDirectory;
  const { files: currentFiles, directories } = scanDirectoryStructure(targetDir);

  const activeBaseline = db.baselines.find(b => b.id === db.activeBaselineId && b.status === 'ACTIVE')
    || db.baselines.find(b => b.status === 'ACTIVE');

  const currentMap = new Map<string, BaselineFileRecord>();
  for (const f of currentFiles) {
    currentMap.set(f.relativePath, f);
  }

  const baselineMap = new Map<string, BaselineFileRecord>();
  if (activeBaseline) {
    for (const f of activeBaseline.files) {
      baselineMap.set(f.relativePath, f);
    }
  }

  let matchedCount = 0;
  let modifiedCount = 0;
  let addedCount = 0;
  let deletedCount = 0;

  // Directory breakdown map: folderPath -> stats
  const dirMap = new Map<string, {
    fileCount: number;
    totalSizeBytes: number;
    matchedCount: number;
    modifiedCount: number;
    addedCount: number;
    deletedCount: number;
  }>();

  for (const dir of directories) {
    dirMap.set(dir, {
      fileCount: 0,
      totalSizeBytes: 0,
      matchedCount: 0,
      modifiedCount: 0,
      addedCount: 0,
      deletedCount: 0
    });
  }

  const getDirForPath = (relPath: string) => {
    const dir = path.dirname(relPath).replace(/\\/g, '/');
    return dir === '.' ? '' : dir;
  };

  // Check baseline records
  if (activeBaseline) {
    for (const [relPath, baseFile] of baselineMap.entries()) {
      const curFile = currentMap.get(relPath);
      const dirKey = getDirForPath(relPath);
      if (!dirMap.has(dirKey)) {
        dirMap.set(dirKey, { fileCount: 0, totalSizeBytes: 0, matchedCount: 0, modifiedCount: 0, addedCount: 0, deletedCount: 0 });
      }
      const dirStat = dirMap.get(dirKey)!;

      if (!curFile) {
        deletedCount++;
        dirStat.deletedCount++;
      } else if (curFile.hash === baseFile.hash) {
        matchedCount++;
        dirStat.matchedCount++;
        dirStat.fileCount++;
        dirStat.totalSizeBytes += curFile.size;
      } else {
        modifiedCount++;
        dirStat.modifiedCount++;
        dirStat.fileCount++;
        dirStat.totalSizeBytes += curFile.size;
      }
    }
  }

  // Check added records (on disk but not in baseline)
  for (const [relPath, curFile] of currentMap.entries()) {
    if (!baselineMap.has(relPath)) {
      addedCount++;
      const dirKey = getDirForPath(relPath);
      if (!dirMap.has(dirKey)) {
        dirMap.set(dirKey, { fileCount: 0, totalSizeBytes: 0, matchedCount: 0, modifiedCount: 0, addedCount: 0, deletedCount: 0 });
      }
      const dirStat = dirMap.get(dirKey)!;
      dirStat.addedCount++;
      dirStat.fileCount++;
      dirStat.totalSizeBytes += curFile.size;
    }
  }

  const totalTracked = matchedCount + modifiedCount + addedCount + deletedCount;
  let integrityScore = 100;
  if (!activeBaseline) {
    integrityScore = 100;
  } else if (totalTracked > 0) {
    integrityScore = Math.round((matchedCount / totalTracked) * 100);
  }

  const directoryBreakdown: DirectorySummary[] = Array.from(dirMap.entries()).map(([dirPath, stat]) => ({
    path: dirPath || '/',
    name: dirPath ? dirPath : 'Root (/)',
    fileCount: stat.fileCount,
    totalSizeBytes: stat.totalSizeBytes,
    matchedCount: stat.matchedCount,
    modifiedCount: stat.modifiedCount,
    addedCount: stat.addedCount,
    deletedCount: stat.deletedCount
  }));

  const trendPoint: IntegrityTrendPoint = {
    timestamp: new Date().toISOString(),
    totalFiles: currentFiles.length,
    totalFolders: directories.length,
    matchedCount,
    modifiedCount,
    addedCount,
    deletedCount,
    integrityScore,
    trigger
  };

  db.trendHistory = db.trendHistory || [];
  const lastPoint = db.trendHistory[db.trendHistory.length - 1];
  if (!lastPoint || (Date.now() - new Date(lastPoint.timestamp).getTime() > 2500) ||
      lastPoint.integrityScore !== trendPoint.integrityScore ||
      lastPoint.totalFiles !== trendPoint.totalFiles ||
      lastPoint.modifiedCount !== trendPoint.modifiedCount ||
      lastPoint.addedCount !== trendPoint.addedCount ||
      lastPoint.deletedCount !== trendPoint.deletedCount) {
    db.trendHistory.push(trendPoint);
    if (db.trendHistory.length > 60) {
      db.trendHistory = db.trendHistory.slice(-60);
    }
    saveDB();
  }

  return {
    totalFiles: currentFiles.length,
    totalFolders: directories.length,
    matchedCount,
    modifiedCount,
    addedCount,
    deletedCount,
    integrityScore,
    directoryBreakdown
  };
}

/**
 * Creates a brand new trusted baseline version.
 */
export function createBaseline(
  targetPath: string,
  name: string,
  createdBy: string,
  notes?: string,
  selectedFiles?: string[]
): Baseline {
  const db = getDB();
  const absoluteTarget = path.isAbsolute(targetPath) ? path.normalize(targetPath) : path.resolve(process.cwd(), targetPath);

  if (!fs.existsSync(absoluteTarget) || !fs.statSync(absoluteTarget).isDirectory()) {
    throw new Error(`Real monitored directory does not exist: ${absoluteTarget}`);
  }
  fs.accessSync(absoluteTarget, fs.constants.R_OK);

  let files = scanDirectoryFiles(absoluteTarget);
  if (selectedFiles && Array.isArray(selectedFiles) && selectedFiles.length > 0) {
    const selectedSet = new Set(selectedFiles.map(s => s.replace(/\\/g, '/')));
    files = files.filter(f => selectedSet.has(f.relativePath) || selectedSet.has(f.path) || selectedSet.has(path.basename(f.relativePath)));
  }
  const totalSizeBytes = files.reduce((acc, f) => acc + f.size, 0);

  // Compute composite root hash
  const sortedHashes = files.map(f => `${f.relativePath}:${f.hash}`).sort().join('|');
  const overallHash = crypto.createHash('sha256').update(sortedHashes).digest('hex');

  const nextVersion = db.baselines.length > 0
    ? Math.max(...db.baselines.map(b => b.version)) + 1
    : 1;

  const baselineId = `bl-v${nextVersion}-${Date.now()}`;

  // Mark prior active baselines as SUPERSEDED
  for (const b of db.baselines) {
    if (b.status === 'ACTIVE') {
      b.status = 'SUPERSEDED';
    }
  }

  const newBaseline: Baseline = {
    id: baselineId,
    version: nextVersion,
    name: name || `Baseline v${nextVersion} (${path.basename(targetPath)})`,
    targetPath: absoluteTarget,
    createdAt: new Date().toISOString(),
    createdBy,
    status: 'ACTIVE',
    fileCount: files.length,
    totalSizeBytes,
    overallHash,
    files,
    notes: notes || `Cryptographic baseline established with ${files.length} monitored items.`
  };

  db.baselines.unshift(newBaseline);
  db.activeBaselineId = baselineId;

  // Log each file hash in Hash Logs
  const timestamp = new Date().toISOString();
  for (const f of files) {
    db.hashLogs.unshift({
      id: `hl-${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${process.hrtime.bigint().toString(36)}`,
      filePath: f.path,
      relativePath: f.relativePath,
      algorithm: 'SHA-256',
      oldHash: null,
      newHash: f.hash,
      status: 'VERIFIED',
      timestamp,
      trigger: 'BASELINE_CREATION',
      baselineId: newBaseline.id
    });
  }

  // Audit entry
  addAuditLog(
    createdBy,
    'BASELINE_CREATED',
    `Created Baseline v${nextVersion} covering ${files.length} files. Root Hash: ${overallHash.substring(0, 16)}...`,
    absoluteTarget
  );

  saveDB();
  broadcastFIMEvent('BASELINE_CREATED', newBaseline);
  return newBaseline;
}

/**
 * Scan filesystem and compare against active baseline to detect modifications, additions, and deletions.
 */
export function scanAndDetectChanges(trigger: 'MANUAL_SCAN' | 'REALTIME_WATCHER' | 'AUTO_SCAN' = 'MANUAL_SCAN', actor = 'SYSTEM'): IntegrityEvent[] {
  const locked = withScanLock(() => _scanAndDetectChangesImpl(trigger, actor));
  return locked ?? [];
}

function _scanAndDetectChangesImpl(trigger: 'MANUAL_SCAN' | 'REALTIME_WATCHER' | 'AUTO_SCAN', actor: string): IntegrityEvent[] {
  const db = getDB();
  const activeBaseline = db.baselines.find(b => b.id === db.activeBaselineId && b.status === 'ACTIVE')
    || db.baselines.find(b => b.status === 'ACTIVE');

  db.config.lastScanTimestamp = new Date().toISOString();

  if (!activeBaseline) {
    saveDB();
    return [];
  }

  const targetRoot = activeBaseline.targetPath;
  if (!fs.existsSync(targetRoot)) {
    saveDB();
    return [];
  }

  const currentFiles = scanDirectoryFiles(targetRoot);
  const currentMap = new Map<string, BaselineFileRecord>();
  for (const f of currentFiles) {
    currentMap.set(f.relativePath, f);
  }

  const baselineMap = new Map<string, BaselineFileRecord>();
  for (const f of activeBaseline.files) {
    baselineMap.set(f.relativePath, f);
  }

  const detectedEvents: IntegrityEvent[] = [];
  const now = new Date().toISOString();

  // 1. Check for MODIFIED files and existing matches
  for (const [relPath, curFile] of currentMap.entries()) {
    const baseFile = baselineMap.get(relPath);

    if (baseFile) {
      if (baseFile.hash !== curFile.hash) {
        // Hash changed -> MODIFIED
        const existingEvent = db.events.find(
          e => e.relativePath === relPath &&
               e.newHash === curFile.hash &&
               e.baselineId === activeBaseline.id &&
               (e.status === 'PENDING_REVIEW' || e.status === 'UNAUTHORIZED')
        );

        if (!existingEvent) {
          let currentContent: string | undefined = undefined;
          if (curFile.isText && curFile.size < 500 * 1024) {
            try {
              currentContent = fs.readFileSync(curFile.path, 'utf-8');
            } catch (e) {}
          }

          const event: IntegrityEvent = {
            id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${process.hrtime.bigint().toString(36)}`,
            baselineId: activeBaseline.id,
            filePath: curFile.path,
            relativePath: relPath,
            changeType: 'MODIFIED',
            detectedAt: now,
            status: 'PENDING_REVIEW',
            oldHash: baseFile.hash,
            newHash: curFile.hash,
            oldSize: baseFile.size,
            newSize: curFile.size,
            isText: curFile.isText,
            previousContent: baseFile.contentSnapshot,
            currentContent
          };

          db.events.unshift(event);
          detectedEvents.push(event);

          db.hashLogs.unshift({
            id: `hl-${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${process.hrtime.bigint().toString(36)}`,
            filePath: curFile.path,
            relativePath: relPath,
            algorithm: 'SHA-256',
            oldHash: baseFile.hash,
            newHash: curFile.hash,
            status: 'MISMATCH',
            timestamp: now,
            trigger: trigger === 'REALTIME_WATCHER' ? 'REALTIME_WATCHER' : 'MANUAL_SCAN',
            baselineId: activeBaseline.id,
            eventId: event.id
          });
        }
      }
    } else {
      // Not in baseline -> CREATED
      const existingEvent = db.events.find(
        e => e.relativePath === relPath &&
             e.changeType === 'CREATED' &&
             e.newHash === curFile.hash &&
             e.baselineId === activeBaseline.id &&
             (e.status === 'PENDING_REVIEW' || e.status === 'UNAUTHORIZED')
      );

      if (!existingEvent) {
        let currentContent: string | undefined = undefined;
        if (curFile.isText && curFile.size < 500 * 1024) {
          try {
            currentContent = fs.readFileSync(curFile.path, 'utf-8');
          } catch (e) {}
        }

        const event: IntegrityEvent = {
          id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${process.hrtime.bigint().toString(36)}`,
          baselineId: activeBaseline.id,
          filePath: curFile.path,
          relativePath: relPath,
          changeType: 'CREATED',
          detectedAt: now,
          status: 'PENDING_REVIEW',
          oldHash: null,
          newHash: curFile.hash,
          oldSize: null,
          newSize: curFile.size,
          isText: curFile.isText,
          currentContent
        };

        db.events.unshift(event);
        detectedEvents.push(event);

        db.hashLogs.unshift({
          id: `hl-${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${process.hrtime.bigint().toString(36)}`,
          filePath: curFile.path,
          relativePath: relPath,
          algorithm: 'SHA-256',
          oldHash: null,
          newHash: curFile.hash,
          status: 'NEW_FILE',
          timestamp: now,
          trigger: trigger === 'REALTIME_WATCHER' ? 'REALTIME_WATCHER' : 'MANUAL_SCAN',
          baselineId: activeBaseline.id,
          eventId: event.id
        });
      }
    }
  }

  // 2. Check for DELETED files (in baseline, but missing on disk)
  for (const [relPath, baseFile] of baselineMap.entries()) {
    if (!currentMap.has(relPath)) {
      const existingEvent = db.events.find(
        e => e.relativePath === relPath &&
             e.changeType === 'DELETED' &&
             e.baselineId === activeBaseline.id &&
             (e.status === 'PENDING_REVIEW' || e.status === 'UNAUTHORIZED' || e.status === 'AUTHORIZED')
      );

      if (!existingEvent) {
        const event: IntegrityEvent = {
          id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${process.hrtime.bigint().toString(36)}`,
          baselineId: activeBaseline.id,
          filePath: baseFile.path,
          relativePath: relPath,
          changeType: 'DELETED',
          detectedAt: now,
          status: 'PENDING_REVIEW',
          oldHash: baseFile.hash,
          newHash: null,
          oldSize: baseFile.size,
          newSize: 0,
          isText: baseFile.isText,
          previousContent: baseFile.contentSnapshot
        };

        db.events.unshift(event);
        detectedEvents.push(event);

        db.hashLogs.unshift({
          id: `hl-${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${process.hrtime.bigint().toString(36)}`,
          filePath: baseFile.path,
          relativePath: relPath,
          algorithm: 'SHA-256',
          oldHash: baseFile.hash,
          newHash: null,
          status: 'DELETED_FILE',
          timestamp: now,
          trigger: trigger === 'REALTIME_WATCHER' ? 'REALTIME_WATCHER' : 'MANUAL_SCAN',
          baselineId: activeBaseline.id,
          eventId: event.id
        });
      }
    }
  }

  // 3. Track the complete lifecycle of files created after the baseline.
  // They are absent from baselineMap, so the baseline-only deletion pass above
  // cannot detect their later removal. Use the most recent CREATED observation
  // as the trusted "previous" state for the deletion event.
  const postBaselineCreates = new Map<string, IntegrityEvent>();
  for (const priorEvent of db.events) {
    if (priorEvent.baselineId === activeBaseline.id &&
        priorEvent.changeType === 'CREATED' &&
        !postBaselineCreates.has(priorEvent.relativePath)) {
      postBaselineCreates.set(priorEvent.relativePath, priorEvent);
    }
  }

  for (const [relPath, createdEvent] of postBaselineCreates.entries()) {
    if (baselineMap.has(relPath) || currentMap.has(relPath)) continue;

    const existingDeletion = db.events.find(
      e => e.relativePath === relPath &&
           e.changeType === 'DELETED' &&
           e.baselineId === activeBaseline.id &&
           (e.status === 'PENDING_REVIEW' || e.status === 'UNAUTHORIZED' || e.status === 'AUTHORIZED')
    );
    if (existingDeletion) continue;

    const event: IntegrityEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${process.hrtime.bigint().toString(36)}`,
      baselineId: activeBaseline.id,
      filePath: createdEvent.filePath,
      relativePath: relPath,
      changeType: 'DELETED',
      detectedAt: now,
      status: 'PENDING_REVIEW',
      oldHash: createdEvent.newHash,
      newHash: null,
      oldSize: createdEvent.newSize,
      newSize: 0,
      isText: createdEvent.isText,
      previousContent: createdEvent.currentContent
    };

    db.events.unshift(event);
    detectedEvents.push(event);
    db.hashLogs.unshift({
      id: `hl-${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${process.hrtime.bigint().toString(36)}`,
      filePath: createdEvent.filePath,
      relativePath: relPath,
      algorithm: 'SHA-256',
      oldHash: createdEvent.newHash,
      newHash: null,
      status: 'DELETED_FILE',
      timestamp: now,
      trigger: trigger === 'REALTIME_WATCHER' ? 'REALTIME_WATCHER' : 'MANUAL_SCAN',
      baselineId: activeBaseline.id,
      eventId: event.id
    });
  }

  if (detectedEvents.length > 0) {
    addAuditLog(
      actor,
      'INTEGRITY_SCAN_DETECTION',
      `Integrity scan detected ${detectedEvents.length} change(s): ${detectedEvents.map(e => `${e.changeType}: ${e.relativePath}`).join(', ')}`,
      targetRoot
    );
  }

  // Update trend history and metrics
  const metrics = computeIntegrityMetrics(trigger);

  saveDB();

  if (detectedEvents.length > 0) {
    for (const event of detectedEvents) {
      broadcastFIMEvent('NEW_EVENT', { event });
    }
    broadcastFIMEvent('INTEGRITY_EVENTS_DETECTED', { events: detectedEvents, count: detectedEvents.length, metrics });
  } else {
    broadcastFIMEvent('INTEGRITY_SCAN_COMPLETED', { metrics });
  }

  return detectedEvents;
}

/**
 * Performs rigorous cryptographic baseline verification without altering baseline.
 */
export function verifyBaseline(baselineId?: string, actor = 'SYSTEM'): BaselineVerificationResult {
  const db = getDB();
  const baseline = baselineId
    ? db.baselines.find(b => b.id === baselineId)
    : db.baselines.find(b => b.id === db.activeBaselineId) || db.baselines[0];

  if (!baseline) {
    throw new Error('No baseline found to verify.');
  }

  const currentFiles = scanDirectoryFiles(baseline.targetPath);
  const currentMap = new Map<string, BaselineFileRecord>();
  for (const f of currentFiles) {
    currentMap.set(f.relativePath, f);
  }

  const baselineMap = new Map<string, BaselineFileRecord>();
  for (const f of baseline.files) {
    baselineMap.set(f.relativePath, f);
  }

  let matchedCount = 0;
  let modifiedCount = 0;
  let addedCount = 0;
  let deletedCount = 0;

  const differences: BaselineVerificationResult['differences'] = [];

  // Check baseline items
  for (const [relPath, baseFile] of baselineMap.entries()) {
    const curFile = currentMap.get(relPath);
    if (!curFile) {
      deletedCount++;
      differences.push({
        filePath: baseFile.relativePath,
        type: 'DELETED',
        expectedHash: baseFile.hash,
        currentHash: null,
        expectedSize: baseFile.size,
        currentSize: null
      });
    } else if (curFile.hash === baseFile.hash) {
      matchedCount++;
      differences.push({
        filePath: baseFile.relativePath,
        type: 'MATCH',
        expectedHash: baseFile.hash,
        currentHash: curFile.hash,
        expectedSize: baseFile.size,
        currentSize: curFile.size
      });
    } else {
      modifiedCount++;
      differences.push({
        filePath: baseFile.relativePath,
        type: 'MODIFIED',
        expectedHash: baseFile.hash,
        currentHash: curFile.hash,
        expectedSize: baseFile.size,
        currentSize: curFile.size
      });
    }
  }

  // Check added items not in baseline
  for (const [relPath, curFile] of currentMap.entries()) {
    if (!baselineMap.has(relPath)) {
      addedCount++;
      differences.push({
        filePath: curFile.relativePath,
        type: 'ADDED',
        expectedHash: null,
        currentHash: curFile.hash,
        expectedSize: null,
        currentSize: curFile.size
      });
    }
  }

  const isPassed = modifiedCount === 0 && addedCount === 0 && deletedCount === 0 && matchedCount === baseline.files.length;
  const status = isPassed ? 'PASSED' : 'INTEGRITY_VIOLATION_DETECTED';

  const verificationResult: BaselineVerificationResult = {
    id: `verif-${Date.now()}`,
    baselineId: baseline.id,
    baselineVersion: baseline.version,
    targetPath: baseline.targetPath,
    timestamp: new Date().toISOString(),
    totalBaselineFiles: baseline.files.length,
    matchedCount,
    modifiedCount,
    addedCount,
    deletedCount,
    status,
    differences
  };

  db.verifications.unshift(verificationResult);

  // Record audit log entry
  addAuditLog(
    actor,
    'BASELINE_VERIFICATION',
    `Baseline v${baseline.version} verification result: ${status} (Matches: ${matchedCount}, Modified: ${modifiedCount}, Added: ${addedCount}, Deleted: ${deletedCount})`,
    baseline.targetPath
  );

  saveDB();
  broadcastFIMEvent('BASELINE_VERIFIED', verificationResult);
  return verificationResult;
}

/**
 * Review an event: Approve (Authorized), Reject (Unauthorized), or Resolve.
 */
export function reviewEvent(
  eventId: string,
  decision: 'APPROVE' | 'REJECT' | 'RESOLVE',
  reviewer: string,
  notes?: string
): IntegrityEvent {
  const db = getDB();
  const event = db.events.find(e => e.id === eventId);
  if (!event) {
    throw new Error(`Event with ID ${eventId} not found`);
  }

  const now = new Date().toISOString();
  event.reviewedBy = reviewer;
  event.reviewedAt = now;
  event.reviewDecision = decision;
  event.reviewNotes = notes || '';

  if (decision === 'APPROVE') {
    event.status = 'AUTHORIZED';
  } else if (decision === 'REJECT') {
    event.status = 'UNAUTHORIZED';
  } else if (decision === 'RESOLVE') {
    event.status = 'RESOLVED';
  }

  addAuditLog(
    reviewer,
    `EVENT_${decision}`,
    `Reviewed event ${event.id} for ${event.relativePath} -> Set status to ${event.status}. Notes: ${notes || 'None'}`,
    event.filePath
  );

  saveDB();
  broadcastFIMEvent('EVENT_UPDATED', event);
  return event;
}

/**
 * Restores a file from baseline snapshot and performs cryptographic recovery verification.
 */
export function restoreFileFromBaseline(
  eventIdOrPath: string,
  actor: string
): { success: boolean; message: string; event?: IntegrityEvent; verification: { expectedHash: string; restoredHash: string; match: boolean } } {
  const db = getDB();
  const event = db.events.find(e => e.id === eventIdOrPath || e.filePath === eventIdOrPath || e.relativePath === eventIdOrPath);

  const activeBaseline = db.baselines.find(b => b.id === (event ? event.baselineId : db.activeBaselineId))
    || db.baselines[0];

  if (!activeBaseline) {
    throw new Error('No baseline available for restoration');
  }

  const relativePath = event ? event.relativePath : eventIdOrPath;
  const baselineFile = activeBaseline.files.find(f => f.relativePath === relativePath || f.path === relativePath);

  if (!baselineFile) {
    throw new Error(`File ${relativePath} not found in Baseline v${activeBaseline.version}`);
  }

  const fullPath = baselineFile.path;

  // Restore content
  if (baselineFile.contentSnapshot !== undefined) {
    // Ensure parent dir exists
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(fullPath, baselineFile.contentSnapshot, 'utf-8');
  } else {
    throw new Error(`No content snapshot available in baseline for ${relativePath} (binary or large file)`);
  }

  // Recalculate hash on disk
  const newHashInfo = calculateFileHash(fullPath);
  if (!newHashInfo) {
    throw new Error(`Failed to read restored file on disk: ${fullPath}`);
  }

  const isMatch = newHashInfo.hash === baselineFile.hash;

  if (event) {
    event.recoveryVerified = isMatch;
    event.recoveryTimestamp = new Date().toISOString();
    if (isMatch) {
      event.status = 'RESOLVED';
      event.reviewDecision = 'RESOLVE';
      event.reviewNotes = `Recovered and cryptographically verified from Baseline v${activeBaseline.version}`;
    }
  }

  // Log in hashLogs
  db.hashLogs.unshift({
    id: `hl-${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${process.hrtime.bigint().toString(36)}`,
    filePath: fullPath,
    relativePath,
    algorithm: 'SHA-256',
    oldHash: event?.newHash || null,
    newHash: newHashInfo.hash,
    status: isMatch ? 'VERIFIED' : 'MISMATCH',
    timestamp: new Date().toISOString(),
    trigger: 'RECOVERY_CHECK',
    baselineId: activeBaseline.id,
    eventId: event?.id
  });

  addAuditLog(
    actor,
    'RECOVERY_VERIFICATION',
    `Restored ${relativePath} from Baseline v${activeBaseline.version}. Expected Hash: ${baselineFile.hash.substring(0, 16)}..., Restored Hash: ${newHashInfo.hash.substring(0, 16)}... Match: ${isMatch ? 'PASSED (100% Cryptographic Match)' : 'FAILED'}`,
    fullPath
  );

  saveDB();
  broadcastFIMEvent('FILE_RECOVERED', { event, relativePath, isMatch });

  return {
    success: isMatch,
    message: isMatch
      ? `File successfully restored and cryptographically verified against Baseline v${activeBaseline.version}`
      : `Restored file hash does not match expected baseline hash!`,
    event,
    verification: {
      expectedHash: baselineFile.hash,
      restoredHash: newHashInfo.hash,
      match: isMatch
    }
  };
}

/**
 * Self-Integrity Verification: Verifies critical FIMGuard system files.
 */
export function initializeSelfIntegrityBaseline(): SelfIntegrityFile[] {
  const db = getDB();
  const criticalFiles = [
    'metadata.json',
    'package.json',
    'tsconfig.json',
    'vite.config.ts',
    'server.ts',
    'server/db.ts',
    'server/fimEngine.ts',
    'server/types.ts',
    'src/App.tsx',
    'src/main.tsx'
  ];

  const results: SelfIntegrityFile[] = [];
  const now = new Date().toISOString();

  for (const rel of criticalFiles) {
    const fullPath = path.resolve(process.cwd(), rel);
    const hashInfo = calculateFileHash(fullPath);
    if (hashInfo) {
      results.push({
        path: rel,
        expectedHash: hashInfo.hash,
        currentHash: hashInfo.hash,
        lastChecked: now,
        status: 'VERIFIED',
        size: hashInfo.size
      });
    }
  }

  db.selfIntegrity = results;
  addAuditLog('SYSTEM', 'SELF_INTEGRITY_INIT', `Established self-integrity baseline for ${results.length} core FIMGuard components.`);
  saveDB();
  return results;
}

export function checkSelfIntegrity(actor = 'SYSTEM'): { files: SelfIntegrityFile[]; allPassed: boolean } {
  const db = getDB();
  if (!db.selfIntegrity || db.selfIntegrity.length === 0) {
    initializeSelfIntegrityBaseline();
  }

  const now = new Date().toISOString();
  let allPassed = true;

  for (const item of db.selfIntegrity) {
    const fullPath = path.resolve(process.cwd(), item.path);
    const hashInfo = calculateFileHash(fullPath);

    item.lastChecked = now;
    if (!hashInfo) {
      item.status = 'MISSING';
      item.currentHash = '';
      allPassed = false;
    } else {
      item.currentHash = hashInfo.hash;
      item.size = hashInfo.size;
      if (hashInfo.hash === item.expectedHash) {
        item.status = 'VERIFIED';
      } else {
        item.status = 'TAMPERED';
        allPassed = false;
      }
    }
  }

  addAuditLog(
    actor,
    'SELF_INTEGRITY_CHECK',
    `Self-integrity verification check: ${allPassed ? 'ALL SECURE (100% Core Verification)' : 'TAMPERING OR MISSING CRITICAL FILE DETECTED'}`
  );

  saveDB();
  return { files: db.selfIntegrity, allPassed };
}

// Watcher instance
let activeWatcher: FSWatcher | null = null;
let watcherDebounceTimeout: NodeJS.Timeout | null = null;

export function setupRealtimeWatcher() {
  const db = getDB();
  if (activeWatcher) {
    try {
      activeWatcher.close();
    } catch (e) {}
    activeWatcher = null;
  }

  let targetDir = db.config.targetDirectory;
  try {
    if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) throw new Error('directory does not exist');
    fs.accessSync(targetDir, fs.constants.R_OK);
  } catch (e: any) {
    console.error(`[FIMGuard] Real target unavailable; watcher not started: "${targetDir}" (${e.message})`);
    return;
  }

  if (!db.config.realtimeMonitoring) {
    console.log('[FIMGuard] Realtime monitoring is disabled in configuration.');
    return;
  }

  console.log(`[FIMGuard] Initializing real-time file system watcher on ${targetDir}`);

  activeWatcher = chokidar.watch(targetDir, {
    ignored: (filePath) => {
      const rel = path.relative(targetDir, filePath).replace(/\\/g, '/');
      return isPathExcluded(rel);
    },
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100
    }
  });

  const handleFsChange = (eventType: string, changedPath: string) => {
    console.log(`[FIMGuard] FS Event: ${eventType} on ${changedPath}`);
    if (watcherDebounceTimeout) clearTimeout(watcherDebounceTimeout);
    watcherDebounceTimeout = setTimeout(() => {
      const current = getDB();
      const active = current.baselines.find(b => b.id === current.activeBaselineId && b.status === 'ACTIVE');
      if (!active || path.resolve(active.targetPath) !== path.resolve(current.config.targetDirectory)) {
        console.warn('[FIMGuard] Filesystem change observed, but no matching active baseline exists.');
        return;
      }
      scanAndDetectChanges('REALTIME_WATCHER');
    }, 400);
  };

  activeWatcher
    .on('add', p => handleFsChange('add', p))
    .on('change', p => handleFsChange('change', p))
    .on('unlink', p => handleFsChange('unlink', p))
    .on('error', err => console.error('[FIMGuard] Watcher error:', err));
}
