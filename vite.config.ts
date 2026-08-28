import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== "true",
      // Runtime database and monitored files are written by the FIM engine, not source code.
      // Watching them would cause periodic dev-server reloads during automatic scans.
      watch:
        process.env.DISABLE_HMR === "true"
          ? null
          : { ignored: ["**/data/**", "**/monitored_targets/**"] },
    },
  };
});
