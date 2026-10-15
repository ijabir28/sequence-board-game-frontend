# Sequence (frontend)

A web client for [Sequence](https://en.wikipedia.org/wiki/Sequence_(game)), the card-and-board game. Built with
Vite, React and TypeScript, and styled with plain CSS modules using the "Tactical Felt" design system from Stitch.

It has two ways to play:

- **On one device (hot-seat).** A complete rules engine runs in the browser, so you can play a full game without the
  server.
- **With the server.** Sign in, open a table, share its code and take seats live. The backend can't run a game yet (see
  [Backend limitations](#backend-limitations)), so a table's line-up can be handed to a hot-seat game, and a developer
  preview shows the server's built-in test game.

## Setup

You need Node.js 18 or later (tested with Node 24) and the backend repository checked out next to this one:

```
personal/
├── sequence-board-game/            backend (Express + Socket.IO)
└── sequence-board-game-frontend/   this project
```

1. **Start the backend first**, on port 3000:

   ```bash
   cd ../sequence-board-game
   npm install
   npm start            # listens on http://localhost:3000
   ```

2. **Start the frontend** in a second terminal:

   ```bash
   npm install
   npm run dev          # http://localhost:5173
   ```

3. Open http://localhost:5173 and sign in with a test account: `jabir` / `1` or `sakib` / `123`.

Hot-seat play (`/local`) works without the backend. Card faces then fall back to drawn cards, because the card images
come from the backend.

To point the dev server at another backend, set `BACKEND_URL`, for example `BACKEND_URL=http://localhost:4000 npm run dev`.

### socket.io versions

The backend asks for `socket.io@latest`, but its lockfile (and a fresh install today) gives **2.3.0**, so this project
pins `socket.io-client@2.3.0`. The two majors must match. If your backend install ends up on a different major
(`node -p "require('../sequence-board-game/node_modules/socket.io/package.json').version"`), change the
`socket.io-client` version in `package.json` to the same major.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with the backend proxy |
| `npm test` | Unit tests (Vitest): rules engine, adapters, API helpers |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the build (uses the same proxy) |

## How it works

### Talking to the backend

The backend has no CORS, so the Vite dev server proxies `/user`, `/room`, `/game`, `/board`, `/images` and `/socket.io`
(websockets included) to `http://localhost:3000`. The session cookie `connect.sid` stays same-origin. App routes are
chosen so they never start with a proxied prefix: `/signin`, `/lobby`, `/table/:id`, `/local` and `/server-game`.

### Code map

```
src/
  engine/          Pure rules engine, no React: cards, board layout, dealing, moves, sequences
  game/
    types.ts       GameAdapter interface and the GameView the UI renders
    local/         LocalGameAdapter: hot-seat game on the engine
    remote/        RemoteGameAdapter + backendQuirks.ts (every backend workaround)
  api/             fetch wrapper, sign-in, rooms, legacy game, socket.io client
  auth/            Remembered profile and route guard
  components/      Board, hand, chips, game screen, UI primitives
  screens/         Sign in, lobby, table, hot-seat setup, server game
  styles/          Design tokens and global CSS
```

### GameAdapter

The game screen only talks to a `GameAdapter`: `getState`, `subscribe`, `legalTargets`, `playCard`,
`exchangeDeadCard`, `pass`, `refresh` and `dispose`.

- **`LocalGameAdapter`** wraps the rules engine. `src/engine/board-layout.json` is a verbatim copy of the backend's
  `data/board_deck.json`, and card names match the backend (`10-Heart`, `J-Spade`, `Blank`).
- **`RemoteGameAdapter`** implements the backend contract: it polls `GET /board/deck` and `GET /game/hand_cards` (there
  are no game socket events) and sends `GET /game/play` with `board_card_index` as URL-encoded JSON. A
  `404 Invalid Move` becomes a readable message.

**Dev toggle:** in dev builds, or in any build after opening a page with `?dev=1`, the game header has a dashed
"dev" button that switches between the two adapters. The lobby also links to the server game.

### Rules engine

The engine implements the official rules:

- 2 or 3 teams with equal team sizes. Only totals the dealing chart covers are offered: 2→7, 3–4→6, 6→5, 8–9→4 and
  10–12→3 cards each.
- Seats alternate teams, and a player draws after every play. When the deck runs out, the discard pile is reshuffled.
- **Two-eyed jacks** (J♣ J♦) place a chip on any empty cell. **One-eyed jacks** (J♠ J♥) remove an opponent's chip that
  isn't part of a completed sequence.
- **Corners** are free spaces that count for every team.
- **Sequences** are 5 in a row in any direction. A new sequence may share at most one chip with the team's earlier
  sequences.
- **Winning** takes 2 sequences with 2 teams, or 1 with 3 teams.
- **Dead cards:** a card whose two cells are both covered can be exchanged once per turn, before playing. If no move is
  possible, the player may pass.

Tests in `src/engine/*.test.ts` cover sequence detection (every direction, corners, 9-long lines, crossing sequences,
the shared-chip limit), both jack types, dead cards and deck reshuffling. They also play random full games and check
invariants.

## Design notes

- **The game screen never scrolls.** It is exactly one viewport tall. The board area is a CSS size container, and the
  board sizes itself to whichever is smaller, the area's width or its height, so all 100 cells are always visible.
  - **Laptops** get a side rail with the hand and the move log.
  - **Phones and tablets** get a collapsible hand strip docked at the bottom; collapsing it gives the board more room.
  - **Phones in landscape** use the side rail, so the board stays usable.
  - The move log is the one region that scrolls, and only inside its own box. On small screens it opens in a dialog.
- **Teams differ by more than colour:** Green chips are circles, Blue are diamonds, Red are triangles, and each has its
  own inner mark. Chips in a completed sequence get a white rim, and a glowing line runs through the sequence.
- **Accessibility:**
  - The board is an ARIA grid. Arrow keys and Home/End move, and Enter or Space plays. Number keys 1–7 pick hand cards
    and Escape clears the selection.
  - Cells have labels such as "7 of Hearts, team 2 chip (Blue, diamond), playable".
  - Focus is always visible, and `prefers-reduced-motion` is respected.
  - No page scrolls horizontally at 360px.

## Backend limitations

These are workarounds for the current backend. Details are in `../sequence-board-game/docs/known-issues.md`, and the
game-related ones are all in `src/game/remote/backendQuirks.ts`.

| Backend behaviour | What the frontend does |
|---|---|
| `GET /user/profile` without a session crashes the server | Called only right after a successful sign-in. The profile is remembered locally. |
| No sign-out | "Switch user" forgets the profile on this device. The server session expires after an hour. |
| Wrong password returns a `302` redirect | Sign-in uses `redirect: 'manual'` and treats any redirect as wrong credentials. |
| `room_updated` goes to every client and has no room id | Each table page re-fetches its own room when the event arrives. |
| No way to start a game from a table | "Play this table on one device" opens a hot-seat game with the table's line-up. |
| No turn order, sequences, dead cards or win in the server game | The server game is labelled a preview, and those controls are hidden. |
