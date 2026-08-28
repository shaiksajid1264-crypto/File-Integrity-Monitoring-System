import fs from 'fs';
import os from 'os';
import path from 'path';

const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'fimguard-realpath-test-'));
const target = path.join(runtime, 'external-target');
fs.mkdirSync(target, { recursive: true });
process.chdir(runtime);

const dbModule = await import('./server/db.ts');
const engine = await import('./server/fimEngine.ts');
const database = dbModule.getDB();
database.config.targetDirectory = target;
database.config.realtimeMonitoring = true;
dbModule.saveDB();

const protectedFile = path.join(target, 'critical.txt');
fs.writeFileSync(protectedFile, 'trusted state', 'utf8');
engine.createBaseline(target, 'Real path test', 'TEST');
const pushedTypes: string[] = [];
engine.subscribeToFIMEvents((type: string) => pushedTypes.push(type));
engine.setupRealtimeWatcher();

await new Promise(resolve => setTimeout(resolve, 700));
fs.writeFileSync(protectedFile, 'tampered state', 'utf8');
await new Promise(resolve => setTimeout(resolve, 1800));

const modified = database.events.find(event => event.changeType === 'MODIFIED' && event.filePath === protectedFile);
if (!modified) throw new Error('Watcher did not create a real-path integrity event');
const audit = database.auditLogs.find(entry => entry.action === 'INTEGRITY_SCAN_DETECTION' && entry.target === target);
if (!audit) throw new Error('Detection was not appended to the tamper-evident audit trail');
if (!pushedTypes.includes('NEW_EVENT') || !pushedTypes.includes('INTEGRITY_EVENTS_DETECTED')) {
  throw new Error('Watcher detection was not broadcast to the React SSE pipeline');
}
if (!dbModule.verifyAuditLogChain().valid) throw new Error('Audit chain failed verification after detection');

engine.reviewEvent(modified.id, 'RESOLVE', 'TEST', 'Validated recurrence behavior');
fs.writeFileSync(protectedFile, 'trusted state', 'utf8');
await new Promise(resolve => setTimeout(resolve, 900));
fs.writeFileSync(protectedFile, 'tampered state', 'utf8');
await new Promise(resolve => setTimeout(resolve, 1200));
const recurrences = database.events.filter(event => event.changeType === 'MODIFIED' && event.filePath === protectedFile);
if (recurrences.length < 2) throw new Error('Repeated tampering with a previously seen hash was suppressed');

const addedFile = path.join(target, 'added.txt');
fs.writeFileSync(addedFile, 'unexpected', 'utf8');
await new Promise(resolve => setTimeout(resolve, 1200));
if (!database.events.some(event => event.changeType === 'CREATED' && event.filePath === addedFile)) {
  throw new Error('Added real-path file did not create an integrity event');
}
fs.unlinkSync(addedFile);
await new Promise(resolve => setTimeout(resolve, 1200));
if (!database.events.some(event => event.changeType === 'DELETED' && event.filePath === addedFile)) {
  throw new Error('Deleting a post-baseline file did not create a lifecycle deletion event');
}
fs.unlinkSync(protectedFile);
await new Promise(resolve => setTimeout(resolve, 1200));
if (!database.events.some(event => event.changeType === 'DELETED' && event.filePath === protectedFile)) {
  throw new Error('Deleted real-path file did not create an integrity event');
}
const lastAudit = database.auditLogs[database.auditLogs.length - 1];
const originalDetails = lastAudit.details;
lastAudit.details = `${originalDetails} tampered`;
if (dbModule.verifyAuditLogChain().valid) throw new Error('Audit verifier accepted a modified ledger entry');
lastAudit.details = originalDetails;
if (!dbModule.verifyAuditLogChain().valid) throw new Error('Audit chain did not recover after restoring the test entry');

console.log('Real-path modify/add/delete, SSE, recurrence, audit-chain, and tamper-rejection checks passed');
process.exit(0);
