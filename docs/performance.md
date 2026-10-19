# Performance: what's worth doing, and what isn't

An evaluation (October 2026) of where WebAssembly, web workers or build changes would make the app faster, lighter
or easier to run. Short version: **the cost is in downloading the app, not in running the game**. So the work done
is code splitting and a service worker. WebAssembly and workers are not used, because there is nothing slow enough
for them to speed up.

## The game's computation is already fast

The only heavy-looking code is the rules engine (`src/engine/`) and the Bot, which plays the training hint
(`suggestMove` in `src/engine/hints.ts`). `src/engine/hints.bench.ts` times them on positions from whole Bot-vs-Bot
games (`npm run bench`). Results on a laptop (Node 24):

| Operation | 2 teams of 1: mean | p99 | 3 teams of 2: mean | p99 |
|---|---|---|---|---|
| `suggestMove` (a whole Bot turn) | 0.11 ms | 0.36 ms | 0.03 ms | 0.19 ms |
| `legalTargets` for a whole hand | 0.05 ms | 0.11 ms | 0.04 ms | 0.07 ms |
| `applyMove` | 0.12 ms | 0.37 ms | 0.03 ms | 0.18 ms |

Even if a low-end phone is ten times slower, a Bot turn takes about 4 ms. A frame lasts 16 ms, and the Bot already
waits on purpose (`BOT_DELAY_MS`) so its move can be followed. Every multiplayer move is decided by the server.

- **WebAssembly: not recommended.** Rewriting the engine in Rust or AssemblyScript would save fractions of a
  millisecond. It would also add a second toolchain to CI and the Docker build, a binary to download, a JS↔WASM
  boundary to copy every `GameState` across, and a second copy of the rules to keep in step with the tests.
- **Web worker: not needed now.** Posting a `GameState` to a worker and back costs about as much as computing the
  move. It becomes worth it only if the Bot gets a search (minimax or Monte Carlo over many moves ahead), which could
  take hundreds of ms. Then move `suggestMove` into a module worker (`new Worker(new URL('./bot.worker.ts',
  import.meta.url), { type: 'module' })`, which Vite bundles itself) behind the same async call `TutorialAdapter`
  makes. Re-run the benchmark first.
- **Card rendering** is SVG and CSS. The deck images are static files the service worker caches on first use.
  Rendering cost is React's, not computation; see "If it ever feels slow" below.

## What was done

1. **Route-level code splitting** (`src/App.tsx`). Sign-in, sign-up and the lobby stay in the main bundle; every
   other screen (game, room, training, how to play, profile) loads on first use.
2. **A vendor chunk** (`vite.config.ts`, `manualChunks`) for React, the router and socket.io, so a deploy that only
   changes the app keeps the same file name for the libraries, and browsers keep their cached copy.
3. **A service worker** (`src/pwa/sw.js`) that precaches every chunk. After the first visit nothing is downloaded
   to open any screen, and hot-seat games and the training work offline.

| First page load | Before | After |
|---|---|---|
| JS | 470 kB (148 kB gzip), 1 file | 315 kB (100 kB gzip): `index` 76 kB + `vendor` 239 kB |
| CSS | 86 kB (15 kB gzip) | 26 kB (6 kB gzip) |
| Repeat visit | HTTP cache, revalidated | served from the service worker |

## Further options, roughly by value

- **Long-lived caching for `/assets/`** (backend, `app.js`). The files are content-hashed, so
  `express.static(frontend_dist, { setHeaders })` could send `Cache-Control: public, max-age=31536000, immutable` for
  `/assets/*`. `sw.js`, `index.html` and `manifest.webmanifest` must stay `no-cache` (Express's default
  `max-age=0` already is). This helps browsers that don't run the service worker.
- **Compression on the backend.** Render's proxy compresses responses already. If it ever doesn't, `compression`
  middleware cuts transfer about 3× (see the gzip column above).
- **socket.io-client 2.3** is about 75 kB of the vendor chunk (22 kB gzip). It's pinned to match the backend's
  socket.io 2 server. The v4 client is smaller and drops the old polyfills, but upgrading is a protocol change on
  both sides.
- **Self-hosting the two Google Fonts** (e.g. with `@fontsource`) removes two cross-origin connections from first
  load and makes the fonts part of the precache. The service worker already caches them after the first visit.

## If it ever feels slow

Profile before adding tooling. React DevTools' Profiler shows which components re-render on each move. The board
(`Board.tsx`) and hand (`HandPanel.tsx`) are the large trees, and the turn bar already keeps its own clock so ticks
don't re-render them. Chrome's Performance panel with 4× CPU throttling approximates a mid-range phone. A benchmark
next to the code, like `hints.bench.ts`, keeps any optimisation honest.
