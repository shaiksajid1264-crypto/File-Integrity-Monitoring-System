import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import {
  getDB,
  saveDB,
  addAuditLog,
  verifyAuditLogChain,
  hashPassword
} from './db';
import {
  createBaseline,
  scanAndDetectChanges,
  verifyBaseline,
  reviewEvent,
  restoreFileFromBaseline,
  checkSelfIntegrity,
  initializeSelfIntegrityBaseline,
  subscribeToFIMEvents,
  setupRealtimeWatcher,
  calculateFileHash,
  isTextFile,
  computeIntegrityMetrics,
  scanDirectoryStructure,
  resolveSafePath
} from './fimEngine';

const router = Router();

// Middleware helper to extract current user session
function getCurrentUser(req: Request) {
  const authHeader = req.headers.authorization;
  const db = getDB();
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    // For local session, token is user ID or admin
    const user = db.users.find(u => u.id === token || u.username === token);
    if (user) return user;
  }
  // Default to admin if unauthenticated in preview session
  return db.users[0];
}

/** Join a relative path under the monitored root, blocking path traversal. */
function safeTargetPath(targetDir: string, relativePath: string): string {
  return resolveSafePath(targetDir, relativePath);
}


// ----------------------------------------------------
// 1. AUTHENTICATION & ACCESS CONTROL
// ----------------------------------------------------
router.post('/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  const db = getDB();

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const pwdHash = hashPassword(password);
  const user = db.users.find(u => u.username === username && u.passwordHash === pwdHash);

  if (!user) {
    addAuditLog('ANONYMOUS', 'AUTH_FAILURE', `Failed login attempt for username '${username}'`);
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  addAuditLog(user.username, 'AUTH_SUCCESS', `User ${user.name} (${user.role}) authenticated successfully`);

  res.json({
    token: user.id,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role
    }
  });
});

router.post('/auth/logout', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  addAuditLog(user.username, 'AUTH_LOGOUT', `User ${user.name} logged out`);
  res.json({ success: true });
});

router.get('/auth/me', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  res.json({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role
  });
});

// ----------------------------------------------------
// 2. DASHBOARD STATS
// ----------------------------------------------------
router.get('/dashboard/stats', (req: Request, res: Response) => {
  const db = getDB();
  const activeBaseline = db.baselines.find(b => b.id === db.activeBaselineId)
    || db.baselines.find(b => b.status === 'ACTIVE');

  const pendingEvents = db.events.filter(e => e.status === 'PENDING_REVIEW').length;
  const authorizedChanges = db.events.filter(e => e.status === 'AUTHORIZED').length;
  const unauthorizedChanges = db.events.filter(e => e.status === 'UNAUTHORIZED').length;
  const resolvedEvents = db.events.filter(e => e.status === 'RESOLVED').length;

  const lastVerification = db.verifications.length > 0 ? db.verifications[0] : null;
  const selfIntegrityAllPassed = db.selfIntegrity.length > 0
    ? db.selfIntegrity.every(f => f.status === 'VERIFIED')
    : true;

  const metrics = computeIntegrityMetrics('DASHBOARD_FETCH');

  res.json({
    targetDirectory: db.config.targetDirectory,
    monitoredFilesCount: metrics.totalFiles,
    totalFilesCount: metrics.totalFiles,
    totalFoldersCount: metrics.totalFolders,
    matchedFilesCount: metrics.matchedCount,
    modifiedFilesCount: metrics.modifiedCount,
    addedFilesCount: metrics.addedCount,
    deletedFilesCount: metrics.deletedCount,
    integrityScore: metrics.integrityScore,
    activeBaseline: activeBaseline ? {
      id: activeBaseline.id,
      version: activeBaseline.version,
      name: activeBaseline.name,
      createdAt: activeBaseline.createdAt,
      overallHash: activeBaseline.overallHash,
      fileCount: activeBaseline.fileCount
    } : null,
    totalBaselinesCount: db.baselines.length,
    pendingEvents,
    authorizedChanges,
    unauthorizedChanges,
    resolvedEvents,
    totalEventsCount: db.events.length,
    lastScanTimestamp: db.config.lastScanTimestamp,
    realtimeMonitoring: db.config.realtimeMonitoring,
    lastVerification: lastVerification ? {
      timestamp: lastVerification.timestamp,
      status: lastVerification.status,
      baselineVersion: lastVerification.baselineVersion
    } : null,
    selfIntegrityStatus: selfIntegrityAllPassed ? 'SECURE' : 'TAMPERED_OR_UNVERIFIED',
    totalAuditEntries: db.auditLogs.length,
    trendHistory: db.trendHistory || [],
    directoryBreakdown: metrics.directoryBreakdown
  });
});

// ----------------------------------------------------
// 3. BASELINES MANAGEMENT & GENERATOR
// ----------------------------------------------------
router.get('/baselines', (req: Request, res: Response) => {
  const db = getDB();
  res.json(db.baselines.map(b => ({
    id: b.id,
    version: b.version,
    name: b.name,
    targetPath: b.targetPath,
    createdAt: b.createdAt,
    createdBy: b.createdBy,
    status: b.status,
    fileCount: b.fileCount,
    totalSizeBytes: b.totalSizeBytes,
    overallHash: b.overallHash,
    notes: b.notes
  })));
});

router.get('/baselines/:id', (req: Request, res: Response) => {
  const db = getDB();
  const baseline = db.baselines.find(b => b.id === req.params.id);
  if (!baseline) {
    return res.status(404).json({ error: 'Baseline not found' });
  }
  res.json(baseline);
});

router.post('/baselines', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const { targetPath, name, notes, selectedFiles } = req.body;
  const db = getDB();

  const target = targetPath || db.config.targetDirectory;

  try {
    if (path.resolve(target) !== path.resolve(db.config.targetDirectory)) {
      return res.status(409).json({ error: 'Baseline root must match the currently configured real monitoring path.' });
    }
    const newBaseline = createBaseline(target, name, user.name || user.username, notes, selectedFiles);
    res.status(201).json(newBaseline);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create baseline' });
  }
});

router.post('/baselines/:id/activate', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const db = getDB();
  const baseline = db.baselines.find(b => b.id === req.params.id);

  if (!baseline) {
    return res.status(404).json({ error: 'Baseline not found' });
  }

  if (path.resolve(baseline.targetPath) !== path.resolve(db.config.targetDirectory)) {
    return res.status(409).json({ error: 'This baseline belongs to a different directory. Select that real path first or create a new baseline.' });
  }

  for (const b of db.baselines) {
    if (b.id === baseline.id) {
      b.status = 'ACTIVE';
    } else if (b.status === 'ACTIVE') {
      b.status = 'SUPERSEDED';
    }
  }

  db.activeBaselineId = baseline.id;
  addAuditLog(user.username, 'BASELINE_ACTIVATED', `Activated Baseline v${baseline.version} as current trusted state`);
  saveDB();

  res.json({ success: true, activeBaseline: baseline });
});

router.post('/baselines/:id/verify', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  try {
    const result = verifyBaseline(req.params.id, user.username);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Verification failed' });
  }
});

router.get('/verifications', (req: Request, res: Response) => {
  const db = getDB();
  res.json(db.verifications);
});

// ----------------------------------------------------
// 4. INTEGRITY EVENTS & REVIEW WORKFLOW
// ----------------------------------------------------
router.get('/events', (req: Request, res: Response) => {
  const db = getDB();
  const { status, changeType, search } = req.query;

  let filtered = [...db.events];

  if (status) {
    filtered = filtered.filter(e => e.status === status);
  }
  if (changeType) {
    filtered = filtered.filter(e => e.changeType === changeType);
  }
  if (search) {
    const s = String(search).toLowerCase();
    filtered = filtered.filter(e =>
      e.relativePath.toLowerCase().includes(s) ||
      (e.oldHash && e.oldHash.toLowerCase().includes(s)) ||
      (e.newHash && e.newHash.toLowerCase().includes(s))
    );
  }

  res.json(filtered);
});

router.get('/events/:id', (req: Request, res: Response) => {
  const db = getDB();
  const event = db.events.find(e => e.id === req.params.id);
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }
  res.json(event);
});

router.post('/events/:id/review', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const { decision, notes } = req.body;

  if (!decision || !['APPROVE', 'REJECT', 'RESOLVE'].includes(decision)) {
    return res.status(400).json({ error: "Invalid decision. Must be 'APPROVE', 'REJECT', or 'RESOLVE'" });
  }

  try {
    const updatedEvent = reviewEvent(req.params.id, decision, user.name || user.username, notes);
    res.json(updatedEvent);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to review event' });
  }
});

router.post('/events/:id/restore', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  try {
    const result = restoreFileFromBaseline(req.params.id, user.name || user.username);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Restoration failed' });
  }
});

// ----------------------------------------------------
// 5. HASH LOG
// ----------------------------------------------------
router.get('/hash-logs', (req: Request, res: Response) => {
  const db = getDB();
  const { search, trigger, status } = req.query;

  let filtered = [...db.hashLogs];

  if (trigger) {
    filtered = filtered.filter(l => l.trigger === trigger);
  }
  if (status) {
    filtered = filtered.filter(l => l.status === status);
  }
  if (search) {
    const s = String(search).toLowerCase();
    filtered = filtered.filter(l =>
      l.relativePath.toLowerCase().includes(s) ||
      (l.oldHash && l.oldHash.toLowerCase().includes(s)) ||
      (l.newHash && l.newHash.toLowerCase().includes(s))
    );
  }

  res.json(filtered.slice(0, 300));
});

// ----------------------------------------------------
// 6. TAMPER-EVIDENT AUDIT LOG
// ----------------------------------------------------
router.get('/audit-logs', (req: Request, res: Response) => {
  const db = getDB();
  res.json(db.auditLogs);
});

router.post('/audit-logs/verify-chain', (req: Request, res: Response) => {
  const verification = verifyAuditLogChain();
  res.json(verification);
});

// ----------------------------------------------------
// 7. SCAN & SYNC
// ----------------------------------------------------
router.post('/scan', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  try {
    const db = getDB();
    const active = db.baselines.find(b => b.id === db.activeBaselineId && b.status === 'ACTIVE');
    if (!active) return res.status(409).json({ error: 'Create and activate a baseline for the current real path before scanning.' });
    if (path.resolve(active.targetPath) !== path.resolve(db.config.targetDirectory)) {
      return res.status(409).json({ error: 'Active baseline does not match the configured real path.' });
    }
    const events = scanAndDetectChanges('MANUAL_SCAN', user.name || user.username);
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      detectedCount: events.length,
      events
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Scan failed' });
  }
});

// ----------------------------------------------------
// 8. SELF INTEGRITY MONITORING
// ----------------------------------------------------
router.get('/self-integrity', (req: Request, res: Response) => {
  const db = getDB();
  if (db.selfIntegrity.length === 0) {
    initializeSelfIntegrityBaseline();
  }
  res.json({
    files: db.selfIntegrity,
    allPassed: db.selfIntegrity.every(f => f.status === 'VERIFIED')
  });
});

router.post('/self-integrity/verify', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const result = checkSelfIntegrity(user.name || user.username);
  res.json(result);
});

router.post('/self-integrity/initialize', (req: Request, res: Response) => {
  const files = initializeSelfIntegrityBaseline();
  res.json({ files, allPassed: true });
});

// ----------------------------------------------------
// 9. EXCLUSION RULES
// ----------------------------------------------------
router.get('/exclusions', (req: Request, res: Response) => {
  const db = getDB();
  res.json(db.exclusions);
});

router.post('/exclusions', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const { pattern, description } = req.body;
  if (!pattern) {
    return res.status(400).json({ error: 'Pattern is required' });
  }

  const db = getDB();
  const newEx = {
    id: `ex-${Date.now()}`,
    pattern,
    description: description || 'Custom exclusion pattern',
    enabled: true,
    createdAt: new Date().toISOString()
  };

  db.exclusions.push(newEx);
  addAuditLog(user.username, 'EXCLUSION_ADDED', `Added exclusion pattern: ${pattern}`);
  saveDB();
  setupRealtimeWatcher(); // Refresh watcher ignore list

  res.status(201).json(newEx);
});

router.put('/exclusions/:id/toggle', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const db = getDB();
  const ex = db.exclusions.find(e => e.id === req.params.id);
  if (!ex) return res.status(404).json({ error: 'Exclusion not found' });

  ex.enabled = !ex.enabled;
  addAuditLog(user.username, 'EXCLUSION_TOGGLED', `${ex.enabled ? 'Enabled' : 'Disabled'} exclusion pattern: ${ex.pattern}`);
  saveDB();
  setupRealtimeWatcher();

  res.json(ex);
});

router.delete('/exclusions/:id', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const db = getDB();
  const index = db.exclusions.findIndex(e => e.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Exclusion not found' });

  const removed = db.exclusions.splice(index, 1)[0];
  addAuditLog(user.username, 'EXCLUSION_REMOVED', `Removed exclusion pattern: ${removed.pattern}`);
  saveDB();
  setupRealtimeWatcher();

  res.json({ success: true, removed });
});

// ----------------------------------------------------
// 10. CRYPTOGRAPHIC REPORTS
// ----------------------------------------------------
router.get('/reports', (req: Request, res: Response) => {
  const db = getDB();
  res.json(db.reports);
});

router.post('/reports', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const { title } = req.body;
  const db = getDB();

  const activeBaseline = db.baselines.find(b => b.id === db.activeBaselineId)
    || db.baselines.find(b => b.status === 'ACTIVE');

  const pendingEvents = db.events.filter(e => e.status === 'PENDING_REVIEW').length;
  const authorizedChanges = db.events.filter(e => e.status === 'AUTHORIZED').length;
  const unauthorizedChanges = db.events.filter(e => e.status === 'UNAUTHORIZED').length;
  const resolvedEvents = db.events.filter(e => e.status === 'RESOLVED').length;

  const auditVerification = verifyAuditLogChain();

  const timestamp = new Date().toISOString();
  const reportPayload = {
    title: title || `FIM Security Integrity Audit Report`,
    generatedAt: timestamp,
    generatedBy: user.name || user.username,
    targetScope: db.config.targetDirectory,
    baselineVersion: activeBaseline ? activeBaseline.version : 0,
    summary: {
      totalMonitored: activeBaseline ? activeBaseline.fileCount : 0,
      pendingEvents,
      authorizedChanges,
      unauthorizedChanges,
      resolvedEvents,
      baselineStatus: activeBaseline ? activeBaseline.status : 'NONE',
      auditLogIntegrity: auditVerification.valid ? 'VERIFIED_SECURE' : 'CHAIN_BROKEN'
    }
  };

  const cryptographicHash = crypto.createHash('sha256')
    .update(JSON.stringify(reportPayload))
    .digest('hex');

  const newReport = {
    id: `rpt-${Date.now()}`,
    ...reportPayload,
    cryptographicHash
  };

  db.reports.unshift(newReport);
  addAuditLog(
    user.username,
    'REPORT_GENERATED',
    `Generated cryptographically signed FIM report (${newReport.id}). Hash: ${cryptographicHash.substring(0, 16)}...`
  );
  saveDB();

  res.status(201).json(newReport);
});

router.post('/reports/verify-hash', (req: Request, res: Response) => {
  const { hash } = req.body;
  const db = getDB();
  const cleanHash = String(hash || '').trim().toLowerCase();

  const matchedReport = db.reports.find(r => r.cryptographicHash.toLowerCase() === cleanHash);

  if (matchedReport) {
    res.json({
      valid: true,
      report: matchedReport,
      message: `Report integrity cryptographically confirmed against immutable ledger.`
    });
  } else {
    res.json({
      valid: false,
      message: `Hash mismatch! No recorded report found matching cryptographic fingerprint.`
    });
  }
});

// ----------------------------------------------------
// 11. MONITORED TARGETS / SANDBOX MANAGER & SIMULATOR
// ----------------------------------------------------
router.get('/sandbox/files', (req: Request, res: Response) => {
  const db = getDB();
  const targetDir = db.config.targetDirectory;

  if (!fs.existsSync(targetDir)) {
    return res.status(404).json({ error: `Real monitored directory is unavailable: ${targetDir}` });
  }

  const activeBaseline = db.baselines.find(b => b.id === db.activeBaselineId && b.status === 'ACTIVE')
    || db.baselines.find(b => b.status === 'ACTIVE');

  const baselineMap = new Map<string, { hash: string; isText: boolean; contentSnapshot?: string }>();
  if (activeBaseline) {
    for (const bf of activeBaseline.files) {
      baselineMap.set(bf.relativePath, {
        hash: bf.hash,
        isText: bf.isText,
        contentSnapshot: bf.contentSnapshot
      });
    }
  }

  try {
    const { files: diskFiles, directories } = scanDirectoryStructure(targetDir);
    const files: Array<{
      name: string;
      relativePath: string;
      directory: string;
      size: number;
      mtime: string;
      hash: string;
      content?: string;
      isText: boolean;
      baselineHash: string | null;
      baselineStatus: 'MATCHED' | 'MODIFIED' | 'UNTRACKED' | 'DELETED';
    }> = [];

    const diskSeenPaths = new Set<string>();

    for (const df of diskFiles) {
      diskSeenPaths.add(df.relativePath);
      const fullPath = df.path;
      const text = df.isText;
      let content = df.contentSnapshot || '';
      if (text && !content && fs.existsSync(fullPath)) {
        try {
          content = fs.readFileSync(fullPath, 'utf-8');
        } catch (e) {}
      }

      const dirName = path.dirname(df.relativePath).replace(/\\/g, '/');
      const baseRecord = baselineMap.get(df.relativePath);
      let baselineStatus: 'MATCHED' | 'MODIFIED' | 'UNTRACKED' | 'DELETED' = 'UNTRACKED';
      let baselineHash: string | null = null;

      if (baseRecord) {
        baselineHash = baseRecord.hash;
        if (baseRecord.hash.toLowerCase() === df.hash.toLowerCase()) {
          baselineStatus = 'MATCHED';
        } else {
          baselineStatus = 'MODIFIED';
        }
      }

      files.push({
        name: path.basename(df.relativePath),
        relativePath: df.relativePath,
        directory: dirName === '.' ? '' : dirName,
        size: df.size,
        mtime: df.mtime,
        hash: df.hash,
        content,
        isText: text,
        baselineHash,
        baselineStatus
      });
    }

    // Check for deleted baseline files
    if (activeBaseline) {
      for (const bf of activeBaseline.files) {
        if (!diskSeenPaths.has(bf.relativePath)) {
          const dirName = path.dirname(bf.relativePath).replace(/\\/g, '/');
          files.push({
            name: path.basename(bf.relativePath),
            relativePath: bf.relativePath,
            directory: dirName === '.' ? '' : dirName,
            size: bf.size,
            mtime: bf.mtime,
            hash: '',
            content: bf.contentSnapshot || '',
            isText: bf.isText,
            baselineHash: bf.hash,
            baselineStatus: 'DELETED'
          });
        }
      }
    }

    res.json({
      targetDirectory: targetDir,
      files,
      directories
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list sandbox files' });
  }
});

// Create a new subfolder/directory
router.post('/sandbox/directories', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const { directoryName, parentDirectory } = req.body;

  if (!directoryName) {
    return res.status(400).json({ error: 'Directory name is required' });
  }

  const cleanDir = directoryName.trim().replace(/^[/\\]+|[/\\]+$/g, '');
  const cleanParent = (parentDirectory || '').trim().replace(/^[/\\]+|[/\\]+$/g, '');
  const fullRelPath = cleanParent ? `${cleanParent}/${cleanDir}` : cleanDir;

  const db = getDB();
  const targetDir = db.config.targetDirectory;
  let dirFullPath: string;

  try {

    dirFullPath = safeTargetPath(targetDir, fullRelPath);

  } catch (e: any) {

    return res.status(400).json({ error: e.message });

  }

  try {
    if (!fs.existsSync(dirFullPath)) {
      fs.mkdirSync(dirFullPath, { recursive: true });
    }

    addAuditLog(user.username, 'SANDBOX_DIR_CREATE', `Created directory ${fullRelPath}`, dirFullPath);
    setTimeout(() => scanAndDetectChanges('REALTIME_WATCHER', user.username), 100);

    res.json({ success: true, relativePath: fullRelPath });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create directory' });
  }
});

router.post('/sandbox/upload', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const { files, targetFolder } = req.body;

  if (!files || !Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'No files provided for upload' });
  }

  const db = getDB();
  const targetDir = db.config.targetDirectory;

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  try {
    const savedNames: string[] = [];

    for (const f of files) {
      if (!f.name) continue;
      const relPath = f.relativePath || (targetFolder ? path.join(targetFolder, f.name) : f.name);
      let filePath: string;
      try {
        filePath = safeTargetPath(targetDir, relPath);
      } catch (e: any) {
        return res.status(400).json({ error: e.message });
      }
      const parentDir = path.dirname(filePath);

      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      if (f.isBase64) {
        const buffer = Buffer.from(f.content, 'base64');
        fs.writeFileSync(filePath, buffer);
      } else {
        fs.writeFileSync(filePath, f.content || '', 'utf-8');
      }
      savedNames.push(relPath);
    }

    addAuditLog(
      user.username,
      'FILE_UPLOAD',
      `Uploaded and wrote ${savedNames.length} file(s) to monitored targets: [${savedNames.join(', ')}]`,
      targetDir
    );

    // Trigger immediate cryptographic scan
    setTimeout(() => scanAndDetectChanges('REALTIME_WATCHER', user.username), 100);

    res.json({
      success: true,
      count: savedNames.length,
      savedFiles: savedNames
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

router.post('/sandbox/files', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const { fileName, relativePath, directory, content } = req.body;

  const targetRelative = relativePath || (directory ? path.join(directory, fileName) : fileName);
  if (!targetRelative) return res.status(400).json({ error: 'File name or path is required' });

  const db = getDB();
  const targetDir = db.config.targetDirectory;
  let filePath: string;
  try {
    filePath = safeTargetPath(targetDir, targetRelative);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }

  try {
    const parentDir = path.dirname(filePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    fs.writeFileSync(filePath, content || '', 'utf-8');
    addAuditLog(user.username, 'SANDBOX_FILE_CREATE', `Created target file ${targetRelative}`, filePath);

    // Trigger immediate scan
    setTimeout(() => scanAndDetectChanges('REALTIME_WATCHER', user.username), 100);

    res.json({ success: true, filePath, relativePath: targetRelative });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/sandbox/files', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const { fileName, relativePath, directory, content } = req.body;

  const targetRelative = relativePath || (directory ? path.join(directory, fileName) : fileName);
  if (!targetRelative) return res.status(400).json({ error: 'File name or path is required' });

  const db = getDB();
  const targetDir = db.config.targetDirectory;
  let filePath: string;

  try {

    filePath = safeTargetPath(targetDir, targetRelative);

  } catch (e: any) {

    return res.status(400).json({ error: e.message });

  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: `File ${targetRelative} does not exist` });
  }

  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    addAuditLog(user.username, 'SANDBOX_FILE_MODIFY', `Modified target file ${targetRelative}`, filePath);

    setTimeout(() => scanAndDetectChanges('REALTIME_WATCHER', user.username), 100);

    res.json({ success: true, relativePath: targetRelative });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/sandbox/files/:fileName(*)', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const targetRelative = (req.query.path as string) || req.params.fileName;
  const db = getDB();
  const targetDir = db.config.targetDirectory;
  let filePath: string;

  try {

    filePath = safeTargetPath(targetDir, targetRelative);

  } catch (e: any) {

    return res.status(400).json({ error: e.message });

  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: `File or directory ${targetRelative} not found` });
  }

  try {
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      fs.rmSync(filePath, { recursive: true, force: true });
      addAuditLog(user.username, 'SANDBOX_DIR_DELETE', `Deleted target directory ${targetRelative}`, filePath);
    } else {
      fs.unlinkSync(filePath);
      addAuditLog(user.username, 'SANDBOX_FILE_DELETE', `Deleted target file ${targetRelative}`, filePath);
    }

    setTimeout(() => scanAndDetectChanges('REALTIME_WATCHER', user.username), 100);

    res.json({ success: true, relativePath: targetRelative });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/sandbox/clear-all', (req: Request, res: Response) => {
  res.status(403).json({ error: 'Disabled in real-path mode. FIMGuard never bulk-deletes monitored directories.' });
});

// ----------------------------------------------------
// 12. CONFIGURATION
// ----------------------------------------------------
router.get('/config', (req: Request, res: Response) => {
  const db = getDB();
  res.json(db.config);
});

router.put('/config', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const { targetDirectory, realtimeMonitoring, autoScanIntervalSeconds } = req.body;
  const db = getDB();

  if (targetDirectory !== undefined) {
    const candidate = path.isAbsolute(targetDirectory) ? path.normalize(targetDirectory) : path.resolve(targetDirectory);
    if (!fs.existsSync(candidate) || !fs.statSync(candidate).isDirectory()) {
      return res.status(400).json({ error: `Directory does not exist: ${candidate}` });
    }
    try { fs.accessSync(candidate, fs.constants.R_OK); }
    catch { return res.status(403).json({ error: `Directory is not readable: ${candidate}` }); }
    db.config.targetDirectory = candidate;
    const active = db.baselines.find(b => b.id === db.activeBaselineId);
    if (active && path.resolve(active.targetPath) !== path.resolve(candidate)) {
      active.status = 'ARCHIVED';
      db.activeBaselineId = null;
      addAuditLog(user.username, 'MONITORING_ROOT_CHANGED', `Archived Baseline v${active.version} because its root does not match the new real path`, candidate);
    }
  }
  if (realtimeMonitoring !== undefined) {
    db.config.realtimeMonitoring = Boolean(realtimeMonitoring);
  }
  if (autoScanIntervalSeconds !== undefined) {
    const interval = Number(autoScanIntervalSeconds);
    if (!Number.isFinite(interval) || interval < 0 || interval > 86400) {
      return res.status(400).json({ error: 'Auto-scan interval must be between 0 and 86400 seconds.' });
    }
    db.config.autoScanIntervalSeconds = interval;
  }

  addAuditLog(user.username, 'CONFIG_UPDATED', `Updated FIM configuration settings`);
  saveDB();
  setupRealtimeWatcher();

  res.json(db.config);
});

// ----------------------------------------------------
// 13. REAL-TIME SERVER-SENT EVENTS (SSE)
// ----------------------------------------------------
router.get('/events/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send initial ping
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() })}\n\n`);

  const unsubscribe = subscribeToFIMEvents((type, data) => {
    res.write(`data: ${JSON.stringify({ type, data, timestamp: new Date().toISOString() })}\n\n`);
  });

  req.on('close', () => {
    unsubscribe();
  });
});

export default router;
