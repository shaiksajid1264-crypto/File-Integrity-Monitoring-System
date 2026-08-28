# FIMGuard - Real Path Edition

This edition keeps the full React security dashboard, baselines, integrity events, hash logs, audit chain, self-integrity checks, and verifiable reports while monitoring original filesystem directories directly.

## Real-path behavior

- Configure an existing absolute directory in **Real Path Inspector** or **System Configuration**.
- FIMGuard validates that the directory exists and is readable.
- SHA-256 baselines are created from the original files at that path.
- Manual scans and the Chokidar watcher read the same original files.
- The saved absolute path remains active after restart.
- There is no automatic fallback to `monitored_targets` for a valid external path.
- Upload/copy controls are hidden, and bulk directory deletion is disabled in real-path mode.

## Run

```bash
npm install
npm run dev
```

Open the local URL printed by the server. Sign in, open **Real Path Inspector**, enter an absolute directory, and click **Open & Monitor Real Path**. Then create a trusted baseline.

Demo accounts remain available from the original project: `admin/admin123`, `analyst/analyst123`, and `auditor/auditor123`.

## Safety

The file inspector can intentionally edit or delete a selected individual file when an authorized user explicitly clicks those controls. The former **Clear Directory** operation is blocked by the server because it is unsafe for real monitored paths.
