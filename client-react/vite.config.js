import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite dev proxies /api + /socket.io to the existing Express + Socket.io backend
// running on :8080 (the user's default dev port). Build output goes to dist/
// which can later be served by Express in production, or by any static host.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api':       { target: 'http://localhost:8080', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:8080', changeOrigin: true, ws: true },
    },
  },
  build: { outDir: 'dist', sourcemap: false },
});
