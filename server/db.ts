import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  FIMGuardDB,
  User,
  Baseline,
  IntegrityEvent,
  HashLogEntry,
  AuditLogEntry,
  BaselineVerificationResult,
  ExclusionRule,
  GeneratedReport,
  SelfIntegrityFile
} from './types';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'fimguard_db.json');
const TARGET_DIR = path.resolve(process.cwd(), 'monitored_targets');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

// Default exclusion patterns
const DEFAULT_EXCLUSIONS: ExclusionRule[] = [
  { id: 'ex-1', pattern: '**/node_modules/**', description: 'Node package dependencies', enabled: true, createdAt: new Date().toISOString() },
  { id: 'ex-2', pattern: '**/.git/**', description: 'Git version control repository', enabled: true, createdAt: new Date().toISOString() },
  { id: 'ex-3', pattern: '**/dist/**', description: 'Build output directories', enabled: true, createdAt: new Date().toISOString() },
  { id: 'ex-4', pattern: '**/*.log', description: 'Dynamic application log files', enabled: true, createdAt: new Date().toISOString() },
  { id: 'ex-5', pattern: '**/*.tmp', description: 'Temporary swap/cache files', enabled: true, createdAt: new Date().toISOString() },
  { id: 'ex-6', pattern: '**/.DS_Store', description: 'macOS folder metadata files', enabled: true, createdAt: new Date().toISOString() }
];

// Helper to hash password (supports optional salt; plain SHA-256 kept for legacy users)
export function hashPassword(pwd: string, salt?: string): string {
  const material = salt ? `${salt}:${pwd}` : pwd;
  return crypto.createHash('sha256').update(material).digest('hex');
}

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${process.hrtime.bigint().toString(36)}`;
}

// Initial Admin and Security Analyst users
const DEFAULT_USERS: User[] = [
  {
    id: 'user-admin',
    username: 'admin',
    name: 'Chief Security Officer (Admin)',
    role: 'admin',
    passwordHash: hashPassword('admin123'),
    createdAt: new Date().toISOString()
  },
  {
    id: 'user-analyst',
    username: 'analyst',
    name: 'Lead SOC Analyst',
    role: 'security_analyst',
    passwordHash: hashPassword('analyst123'),
    createdAt: new Date().toISOString()
  },
  {
    id: 'user-auditor',
    username: 'auditor',
    name: 'Compliance Auditor',
    role: 'auditor',
    passwordHash: hashPassword('auditor123'),
    createdAt: new Date().toISOString()
  }
];

function getGenesisAuditLog(): AuditLogEntry {
  const timestamp = new Date().toISOString();
  const entry: AuditLogEntry = {
    id: 'audit-0',
    index: 0,
    timestamp,
    actor: 'SYSTEM',
    action: 'FIM_GENESIS_INITIALIZATION',
    details: 'Cryptographic audit ledger genesis node initialized for FIMGuard.',
    prevHash: '0000000000000000000000000000000000000000000000000000000000000000',
    hash: ''
  };
  const payload = `${entry.index}:${entry.timestamp}:${entry.actor}:${entry.action}:${entry.details}::${entry.prevHash}`;
  entry.hash = crypto.createHash('sha256').update(payload).digest('hex');
  return entry;
}

// In-memory representation with write-through persistence
let dbState: FIMGuardDB;

function createDefaultDB(): FIMGuardDB {
  return {
    users: DEFAULT_USERS,
    baselines: [],
    activeBaselineId: null,
    events: [],
    hashLogs: [],
    auditLogs: [getGenesisAuditLog()],
    verifications: [],
    exclusions: DEFAULT_EXCLUSIONS,
    reports: [],
    selfIntegrity: [],
    trendHistory: [],
    config: {
      targetDirectory: TARGET_DIR,
      realtimeMonitoring: true,
      autoScanIntervalSeconds: 60,
      lastScanTimestamp: null
    }
  };
}

export function loadDB(): FIMGuardDB {
  if (dbState) return dbState;

  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      dbState = JSON.parse(raw);
      // Ensure all arrays exist in case of version migration
      dbState.users = dbState.users || DEFAULT_USERS;
      dbState.baselines = dbState.baselines || [];
      dbState.events = dbState.events || [];
      dbState.hashLogs = dbState.hashLogs || [];
      dbState.auditLogs = dbState.auditLogs || [getGenesisAuditLog()];
      dbState.verifications = dbState.verifications || [];
      dbState.exclusions = dbState.exclusions || DEFAULT_EXCLUSIONS;
      dbState.reports = dbState.reports || [];
      dbState.selfIntegrity = dbState.selfIntegrity || [];
      dbState.trendHistory = dbState.trendHistory || [];
      const savedTarget = dbState.config?.targetDirectory || TARGET_DIR;
      // Real-path mode: preserve any existing absolute directory, including paths
      // outside the project. FIMGuard reads and watches the original files in place.
      let resolvedTarget = path.isAbsolute(savedTarget)
        ? path.normalize(savedTarget)
        : path.resolve(process.cwd(), savedTarget);
      try {
        const stat = fs.statSync(resolvedTarget);
        if (!stat.isDirectory()) throw new Error('configured target is not a directory');
        fs.accessSync(resolvedTarget, fs.constants.R_OK);
      } catch (e: any) {
        // Preserve the configured real path so an offline drive or temporary
        // permission problem is visible instead of silently changing scope.
        console.warn(`[FIMGuard] Saved real target is currently unavailable ("${resolvedTarget}"): ${e.message}.`);
      }

      dbState.config = {
        targetDirectory: resolvedTarget,
        realtimeMonitoring: dbState.config?.realtimeMonitoring ?? true,
        autoScanIntervalSeconds: dbState.config?.autoScanIntervalSeconds || 60,
        lastScanTimestamp: dbState.config?.lastScanTimestamp || null
      };
      const activeBaseline = dbState.baselines.find(b => b.id === dbState.activeBaselineId);
      if (activeBaseline && path.resolve(activeBaseline.targetPath) !== path.resolve(resolvedTarget)) {
        activeBaseline.status = 'ARCHIVED';
        dbState.activeBaselineId = null;
        console.warn(`[FIMGuard] Archived mismatched baseline v${activeBaseline.version}; create a baseline for ${resolvedTarget}.`);
      }
      // Persist corrected path so next start is clean
      try { saveDB(); } catch (_) {}
      return dbState;
    } catch (e) {
      console.error('Failed to parse database file, reinitializing default DB:', e);
    }
  }

  dbState = createDefaultDB();
  saveDB();
  return dbState;
}

export function saveDB() {
  if (!dbState) return;
  try {
    const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(dbState, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('Error writing database to disk:', err);
  }
}

export function getDB(): FIMGuardDB {
  return loadDB();
}

/**
 * Append an entry to the tamper-evident audit log with chained SHA-256 hash.
 */
export function addAuditLog(actor: string, action: string, details: string, target?: string): AuditLogEntry {
  const db = getDB();
  const lastEntry = db.auditLogs.length > 0
    ? db.auditLogs[db.auditLogs.length - 1]
    : getGenesisAuditLog();

  const index = lastEntry.index + 1;
  const timestamp = new Date().toISOString();
  const prevHash = lastEntry.hash;

  const entryPayload = `${index}:${timestamp}:${actor}:${action}:${details}:${target || ''}:${prevHash}`;
  const hash = crypto.createHash('sha256').update(entryPayload).digest('hex');

  const newEntry: AuditLogEntry = {
    id: `audit-${index}-${Date.now()}`,
    index,
    timestamp,
    actor,
    action,
    details,
    target,
    prevHash,
    hash
  };

  db.auditLogs.push(newEntry);
  saveDB();
  return newEntry;
}

/**
 * Validate the complete cryptographic audit ledger chain.
 */
export function verifyAuditLogChain(): { valid: boolean; totalEntries: number; brokenIndex?: number; reason?: string } {
  const db = getDB();
  const logs = db.auditLogs;

  if (!logs || logs.length === 0) {
    return { valid: true, totalEntries: 0 };
  }

  for (let i = 0; i < logs.length; i++) {
    const entry = logs[i];

    if (i === 0) {
      // Genesis verification
      if (entry.prevHash !== '0000000000000000000000000000000000000000000000000000000000000000') {
        return { valid: false, totalEntries: logs.length, brokenIndex: 0, reason: 'Genesis previous hash mismatch' };
      }
      const canonicalPayload = `${entry.index}:${entry.timestamp}:${entry.actor}:${entry.action}:${entry.details}::${entry.prevHash}`;
      const legacyPayload = `0:${entry.timestamp}:SYSTEM:FIM_GENESIS_INITIALIZATION:Genesis block established:${entry.prevHash}`;
      const expectedCanonical = crypto.createHash('sha256').update(canonicalPayload).digest('hex');
      const expectedLegacy = crypto.createHash('sha256').update(legacyPayload).digest('hex');
      if (entry.hash !== expectedCanonical && entry.hash !== expectedLegacy) {
        return { valid: false, totalEntries: logs.length, brokenIndex: 0, reason: 'Genesis payload checksum corrupted' };
      }
      continue;
    }

    const prevEntry = logs[i - 1];

    if (entry.prevHash !== prevEntry.hash) {
      return {
        valid: false,
        totalEntries: logs.length,
        brokenIndex: i,
        reason: `Hash link broken between entry #${prevEntry.index} and #${entry.index}`
      };
    }

    const entryPayload = `${entry.index}:${entry.timestamp}:${entry.actor}:${entry.action}:${entry.details}:${entry.target || ''}:${entry.prevHash}`;
    const calculatedHash = crypto.createHash('sha256').update(entryPayload).digest('hex');

    if (calculatedHash !== entry.hash) {
      return {
        valid: false,
        totalEntries: logs.length,
        brokenIndex: i,
        reason: `Cryptographic payload checksum corrupted at entry #${entry.index}`
      };
    }
  }

  return { valid: true, totalEntries: logs.length };
}
