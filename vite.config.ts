/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The backend has no CORS, so everything it serves goes through this proxy and the
// session cookie stays same-origin. Keys are regexes so SPA routes such as /lobby or
// /table/:id are never proxied.
const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '^/(user|room|game|board|images)/': { target: BACKEND, changeOrigin: true },
      '/socket.io': { target: BACKEND, changeOrigin: true, ws: true },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
