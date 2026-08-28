import fs from 'fs';
import path from 'path';

export interface User {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'security_analyst' | 'auditor';
  passwordHash: string; // SHA-256 for demo
  createdAt: string;
}

export interface BaselineFileRecord {
  path: string;
  relativePath: string;
  hash: string;
  size: number;
  mtime: string;
  isText: boolean;
  contentSnapshot?: string; // Captured for text diffing
}

export interface Baseline {
  id: string;
  version: number;
  name: string;
  targetPath: string;
  createdAt: string;
  createdBy: string;
  status: 'ACTIVE' | 'ARCHIVED' | 'SUPERSEDED';
  fileCount: number;
  totalSizeBytes: number;
  overallHash: string; // SHA-256 of concatenated sorted file hashes
  files: BaselineFileRecord[];
  notes?: string;
}

export type EventStatus = 'PENDING_REVIEW' | 'AUTHORIZED' | 'UNAUTHORIZED' | 'RESOLVED';
export type EventChangeType = 'MODIFIED' | 'CREATED' | 'DELETED' | 'PERMISSIONS_CHANGED';

export interface IntegrityEvent {
  id: string;
  baselineId: string;
  filePath: string;
  relativePath: string;
  changeType: EventChangeType;
  detectedAt: string;
  status: EventStatus;
  oldHash: string | null;
  newHash: string | null;
  oldSize: number | null;
  newSize: number | null;
  isText: boolean;
  previousContent?: string;
  currentContent?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewDecision?: 'APPROVE' | 'REJECT' | 'RESOLVE';
  reviewNotes?: string;
  recoveryVerified?: boolean;
  recoveryTimestamp?: string;
}

export interface HashLogEntry {
  id: string;
  filePath: string;
  relativePath: string;
  algorithm: 'SHA-256';
  oldHash: string | null;
  newHash: string | null;
  status: 'MATCH' | 'MISMATCH' | 'NEW_FILE' | 'DELETED_FILE' | 'VERIFIED';
  timestamp: string;
  trigger: 'BASELINE_CREATION' | 'REALTIME_WATCHER' | 'MANUAL_SCAN' | 'VERIFICATION' | 'RECOVERY_CHECK' | 'SELF_CHECK';
  baselineId?: string;
  eventId?: string;
}

export interface AuditLogEntry {
  id: string;
  index: number;
  timestamp: string;
  actor: string;
  action: string;
  details: string;
  target?: string;
  prevHash: string;
  hash: string;
}

export interface BaselineVerificationResult {
  id: string;
  baselineId: string;
  baselineVersion: number;
  targetPath: string;
  timestamp: string;
  totalBaselineFiles: number;
  matchedCount: number;
  modifiedCount: number;
  addedCount: number;
  deletedCount: number;
  status: 'PASSED' | 'INTEGRITY_VIOLATION_DETECTED';
  differences: Array<{
    filePath: string;
    type: 'MODIFIED' | 'ADDED' | 'DELETED' | 'MATCH';
    expectedHash: string | null;
    currentHash: string | null;
    expectedSize: number | null;
    currentSize: number | null;
  }>;
}

export interface ExclusionRule {
  id: string;
  pattern: string;
  description: string;
  enabled: boolean;
  createdAt: string;
}

export interface GeneratedReport {
  id: string;
  title: string;
  generatedAt: string;
  generatedBy: string;
  targetScope: string;
  baselineVersion: number;
  summary: {
    totalMonitored: number;
    pendingEvents: number;
    authorizedChanges: number;
    unauthorizedChanges: number;
    resolvedEvents: number;
    baselineStatus: string;
    auditLogIntegrity: string;
  };
  cryptographicHash: string; // SHA-256 fingerprint of report payload
}

export interface SelfIntegrityFile {
  path: string;
  expectedHash: string;
  currentHash: string;
  lastChecked: string;
  status: 'VERIFIED' | 'TAMPERED' | 'MISSING';
  size: number;
}

export interface IntegrityTrendPoint {
  timestamp: string;
  totalFiles: number;
  totalFolders: number;
  matchedCount: number;
  modifiedCount: number;
  addedCount: number;
  deletedCount: number;
  integrityScore: number;
  trigger: string;
}

export interface DirectorySummary {
  path: string;
  name: string;
  fileCount: number;
  totalSizeBytes: number;
  matchedCount: number;
  modifiedCount: number;
  addedCount: number;
  deletedCount: number;
}

export interface FIMGuardDB {
  users: User[];
  baselines: Baseline[];
  activeBaselineId: string | null;
  events: IntegrityEvent[];
  hashLogs: HashLogEntry[];
  auditLogs: AuditLogEntry[];
  verifications: BaselineVerificationResult[];
  exclusions: ExclusionRule[];
  reports: GeneratedReport[];
  selfIntegrity: SelfIntegrityFile[];
  trendHistory: IntegrityTrendPoint[];
  config: {
    targetDirectory: string;
    realtimeMonitoring: boolean;
    autoScanIntervalSeconds: number;
    lastScanTimestamp: string | null;
  };
}
