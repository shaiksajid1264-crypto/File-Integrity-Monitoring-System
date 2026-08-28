# FIMGuard — Real-Path File Integrity Monitoring System

FIMGuard is a full-stack File Integrity Monitoring (FIM) platform that protects files in their **original Windows directories**. It establishes trusted SHA-256 baselines, watches the real filesystem continuously, detects created, modified, and deleted files, and connects every incident to cryptographic evidence, a tamper-evident audit trail, live security metrics, and recovery actions.

Unlike sandbox-based demonstrations that monitor uploaded copies, FIMGuard scans and watches the actual directory selected by the user. Its goal is to provide a lightweight, evidence-driven FIM workflow suitable for cybersecurity demonstrations, learning, and further research.

## Key differentiators

- **Real-path monitoring:** Baselines, scans, alerts, and recovery operate on the original absolute filesystem path.
- **Complete file lifecycle tracking:** Detects deletion of both baseline files and unknown files created after the baseline.
- **Evidence correlation:** Connects filesystem activity, SHA-256 comparisons, integrity events, hash logs, audit records, dashboard metrics, and reports.
- **Verified recovery:** Restores eligible text files and proves recovery by comparing the restored SHA-256 hash with the trusted baseline.
- **Self-integrity protection:** Detects modification or removal of FIMGuard's own critical components.
- **Tamper-evident audit ledger:** Chains audit entries using SHA-256 so historical modification can be detected.
- **Layered detection:** Combines real-time filesystem events, manual scans, and configurable periodic scans.

## How it works

```text
Select an existing real directory
                ↓
Create a trusted SHA-256 baseline
                ↓
Watch filesystem events and perform scheduled scans
                ↓
Compare current file state with the active baseline
                ↓
Detect CREATED, MODIFIED, and DELETED files
                ↓
Generate integrity events, hash evidence, audit entries,
live metrics, investigation records, and reports
```

A baseline records each included file's path, SHA-256 hash, size, modification time, file type, and—when eligible—a text-content snapshot. The baseline is never silently updated after a change. Legitimate changes become trusted only when an authorized user explicitly creates a new baseline.

## Features

### Integrity monitoring

- Recursive monitoring of files and nested directories under the active root path
- SHA-256 cryptographic hashing
- `CREATED`, `MODIFIED`, and `DELETED` change detection
- Real-time monitoring with Chokidar
- Manual integrity scans
- Configurable automatic scan interval
- Duplicate-alert suppression with recurrence detection after resolution
- Glob-style exclusion rules

### Investigation and response

- Detailed integrity events with old/new hashes and sizes
- Text-content comparison when snapshots are available
- Event classification as pending, authorized, unauthorized, or resolved
- Recovery of eligible modified or deleted text files
- Cryptographic verification after restoration
- Dedicated hash-calculation logs

### Security and evidence

- SHA-256-chained tamper-evident audit ledger
- Complete audit-chain verification
- Self-integrity baseline for critical FIMGuard components
- Cryptographically fingerprinted security reports
- Server-Sent Events (SSE) for live dashboard updates
- Safety validation for real paths and blocked bulk directory deletion

### Dashboard and visualization

- Current integrity posture and monitored-file statistics
- Pending, authorized, and unauthorized event counters
- Integrity trend graph
- Added, modified, deleted, and matching file metrics
- Directory-level integrity summaries
- Baseline, audit-chain, and self-integrity status
- Dark/light interface support

## Technology stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 19, TypeScript, Tailwind CSS, Recharts, Lucide, Motion |
| Backend | Node.js, Express, TypeScript |
| Monitoring | Chokidar, Node.js filesystem APIs |
| Cryptography | Node.js `crypto`, SHA-256 |
| Live updates | Server-Sent Events |
| Reports | jsPDF, jsPDF AutoTable |
| Tooling | Vite, TSX, esbuild |
| Prototype storage | Local JSON database |

## Architecture

```text
React Security Dashboard
          │
          │ REST API + SSE
          ▼
Express API Server
          │
          ├── Authentication and event-review routes
          ├── Baseline, audit, report, and configuration routes
          └── Real-path file-inspection routes
          │
          ▼
FIM Integrity Engine
          │
          ├── SHA-256 hashing and baseline comparison
          ├── Chokidar real-time watcher
          ├── Metrics and directory summaries
          ├── Verified file recovery
          └── Self-integrity verification
          │
          ▼
Original Windows Directory + Local JSON Database
```

## Installation

### Requirements

- Node.js 20 or newer
- npm
- Windows, Linux, or macOS filesystem access (the project is primarily demonstrated on Windows)

### Run in development mode

```bash
git clone https://github.com/shaiksajid1264-crypto/File-Integrity-Monitoring-System.git
cd File-Integrity-Monitoring-System
npm install
npm run dev
```

Open the exact local URL printed by the server. Port `3000` is preferred; if it is occupied, FIMGuard automatically selects the next available port.

### Production build

```bash
npm run build
npm start
```

### Validation

```bash
npm run lint
```

## Quick demonstration

1. Sign in and open **Real Path Inspector** or **System Configuration**.
2. Enter an existing absolute directory that is safe to modify during testing.
3. Create and activate a trusted baseline.
4. Modify one baseline file, add a new file, and delete another file.
5. Observe the live Integrity Events and SHA-256 evidence.
6. Review an event as authorized or unauthorized.
7. Restore an eligible text file from the baseline and verify its recovered hash.
8. Open the Audit Trail and verify the cryptographic chain.
9. Run Self-Integrity verification and generate a report.

> **Safety:** Always use a disposable demonstration directory. Do not modify or delete operating-system files to demonstrate FIMGuard.

## Demo accounts

| Role | Username | Password |
| --- | --- | --- |
| Administrator | `admin` | `admin123` |
| Security Analyst | `analyst` | `analyst123` |
| Auditor | `auditor` | `auditor123` |

These accounts are included only for local demonstration. Replace the prototype authentication before any real deployment.

## Current scope

FIMGuard currently supports one active root directory and one matching active baseline at a time. It recursively monitors multiple files and nested directories beneath that root. Simultaneous monitoring of several unrelated root paths is a planned architectural extension.

The local JSON database is intentionally used to keep the academic prototype portable. A production deployment should use a transactional database, stronger password hashing, strict role-based authorization middleware, encrypted storage, HTTPS, signed baselines, centralized alert delivery, backup integration, and operating-system service management.

## Data and privacy

Runtime integrity records are stored under `data/` and are excluded from Git. The repository also excludes monitored-target content, environment secrets, dependencies, logs, and build artifacts. Never commit a live monitoring database because it may contain local paths, event history, or file-content snapshots.

## Disclaimer

FIMGuard is an educational and research prototype. Test it only on files and directories you own or are authorized to monitor. It should complement—not replace—access controls, endpoint protection, secure backups, and centralized security monitoring.

## Author

Developed by **Shaik Sajid** as a cybersecurity File Integrity Monitoring project.
