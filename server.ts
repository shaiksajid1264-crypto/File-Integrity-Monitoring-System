import express from 'express';
import path from 'path';
import net from 'net';
import { createServer as createViteServer } from 'vite';
import routes from './server/routes';
import { loadDB } from './server/db';
import {
  setupRealtimeWatcher,
  initializeSelfIntegrityBaseline,
  scanAndDetectChanges
} from './server/fimEngine';

function findAvailablePort(startPort: number, attempts = 20): Promise<number> {
  return new Promise((resolve, reject) => {
    const tryPort = (port: number, remaining: number) => {
      const probe = net.createServer();
      probe.unref();
      probe.once('error', (error: NodeJS.ErrnoException) => {
        probe.close();
        if (error.code === 'EADDRINUSE' && remaining > 0) tryPort(port + 1, remaining - 1);
        else reject(error);
      });
      probe.listen(port, '127.0.0.1', () => {
        probe.close(() => resolve(port));
      });
    };
    tryPort(startPort, attempts);
  });
}

async function startServer() {
  const app = express();
  const preferredPort = Number(process.env.PORT || 3000);
  const PORT = await findAvailablePort(Number.isFinite(preferredPort) ? preferredPort : 3000);

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Initialize DB and real core system self-integrity baseline
  const db = loadDB();
  if (!db.selfIntegrity || db.selfIntegrity.length === 0) {
    initializeSelfIntegrityBaseline();
  }

  // Setup real-time file watcher
  setupRealtimeWatcher();

  // API Routes mount
  app.use('/api', routes);

  // Dynamic automatic scan scheduler. The configured interval takes effect
  // immediately without requiring a server restart.
  let lastAutoScanAt = 0;
  setInterval(() => {
    try {
      const currentDB = loadDB();
      const intervalMs = Math.max(0, Number(currentDB.config.autoScanIntervalSeconds || 0)) * 1000;
      const hasActiveBaseline = currentDB.baselines.some(b => b.id === currentDB.activeBaselineId && b.status === 'ACTIVE');
      if (intervalMs > 0 && hasActiveBaseline && Date.now() - lastAutoScanAt >= intervalMs) {
        lastAutoScanAt = Date.now();
        scanAndDetectChanges('AUTO_SCAN', 'SYSTEM_SCHEDULER');
      }
    } catch (e) {
      console.error('[FIMGuard] Auto-scan error:', e);
    }
  }, 1000);

  // Vite middleware for development vs. Production static serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      // HMR is unnecessary for this local security console and can collide
      // with stale Vite WebSocket processes. Source changes take effect after
      // restarting `npm run dev`.
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    if (PORT !== preferredPort) {
      console.warn(`[FIMGuard] Port ${preferredPort} was busy; selected ${PORT} instead.`);
    }
    console.log(`[FIMGuard] Server operational at http://localhost:${PORT}`);
  });
  server.on('error', (error: NodeJS.ErrnoException) => {
    console.error(`[FIMGuard] Unable to start HTTP server: ${error.message}`);
    process.exitCode = 1;
  });
}

startServer().catch(err => {
  console.error('[FIMGuard] Failed to start server:', err);
});
