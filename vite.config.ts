/// <reference types="vitest" />
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// The backend has no CORS, so everything it serves goes through this proxy and the session cookie stays
// same-origin. Keys are regexes so SPA routes such as /lobby or /table/:id are never proxied.
const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:3000';

/**
 * Writes /sw.js (src/pwa/sw.js) into the build, filled in with every file it should cache up front: the built
 * files and the public ones, less the card decks (6 MB; those are cached as they're used). The version is a hash of
 * those files, so a build that changes anything installs a new worker and one that changes nothing doesn't.
 */
function serviceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    writeBundle() {
      const files = (readdirSync(outDir, { recursive: true, withFileTypes: true }) as import('node:fs').Dirent[])
        .filter((entry) => entry.isFile())
        .map((entry) => path.relative(outDir, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'))
        .filter((file) => !file.startsWith('decks/') && file !== 'sw.js' && !file.endsWith('.map'))
        .sort();
      const hash = createHash('sha256');
      for (const file of files) hash.update(file).update(readFileSync(path.join(outDir, file)));
      const source = readFileSync(path.resolve(__dirname, 'src/pwa/sw.js'), 'utf8')
        .replace('__SW_VERSION__', hash.digest('hex').slice(0, 12))
        .replace('__SW_PRECACHE__', JSON.stringify(files.map((file) => `/${file}`)));
      writeFileSync(path.join(outDir, 'sw.js'), source);
    },
  };
}

export default defineConfig({
  plugins: [react(), serviceWorker()],
  build: {
    rollupOptions: {
      output: {
        // Libraries change far less often than the app, so they get their own file: a deploy that only touches the
        // app leaves this one's name, and the copy already in browsers' caches, as they were.
        manualChunks: { vendor: ['react', 'react-dom', 'react-router-dom', 'socket.io-client'] },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '^/(api|user|room|game|board|images)/': { target: BACKEND, changeOrigin: true },
      '/socket.io': { target: BACKEND, changeOrigin: true, ws: true },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
