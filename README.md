# Sequence (frontend)

A web client for [Sequence](https://en.wikipedia.org/wiki/Sequence_(game)), the card-and-board game. Built with
Vite, React and TypeScript, and styled with plain CSS modules using the "Tactical Felt" design system from Stitch.

It has two ways to play:

- **On one device (hot-seat).** A complete rules engine runs in the browser, so you can play a full game without the
  server.
- **With the server.** Create an account or sign in, open a table, share its code and take seats live. Once every seat is taken, any player
  starts the game and everyone plays from their own device; the server deals, enforces turn order and detects
  sequences. Tables and games are saved on the server, so the lobby's "Your tables" list lets you resume a game
  later, even after the backend restarts. A developer page also shows the server's older built-in test game.

## Setup

You need Node.js 18 or later (tested with Node 24) and the backend repository checked out next to this one, both
inside a shared `sequence-board-game/` folder:

```
sequence-board-game/
├── sequence-board-game/            backend (Express + Socket.IO)
└── sequence-board-game-frontend/   this project
```

The two repos only need to be siblings: the steps below and the docs refer to the backend as `../sequence-board-game`.

**With Docker** (only Docker needed), from the backend repo:

```bash
cd ../sequence-board-game
docker compose up      # PostgreSQL, backend on :3000, this frontend on :5173
```

Then open http://localhost:5173. Code changes in either repo reload live.

**Without Docker for the apps:**

1. **Start the backend first**, on port 3000. It needs PostgreSQL; the simplest way is the backend's compose
   database:

   ```bash
   cd ../sequence-board-game
   docker compose up -d db   # or point DATABASE_URL at your own PostgreSQL
   npm install
   npm start            # listens on http://localhost:3000
   ```

2. **Start the frontend** in a second terminal:

   ```bash
   npm install
   npm run dev          # http://localhost:5173
   ```

3. Open http://localhost:5173 and create an account, or sign in with a development account: `jabir` / `1` or
   `sakib` / `123`. Docker creates these itself; for a host-run backend, run `npm run db:seed` there once.

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
chosen so they never start with a proxied prefix: `/signin`, `/signup`, `/lobby`, `/table/:id`, `/local` and `/server-game`.

### Code map

```
src/
  engine/          Pure rules engine, no React: cards, board layout, dealing, moves, sequences
  game/
    types.ts       GameAdapter interface and the GameView the UI renders
    local/         LocalGameAdapter: hot-seat game on the engine
    remote/        RemoteGameAdapter + backendQuirks.ts (every backend workaround)
  api/             fetch wrapper, accounts (sign up / in / out, profile), rooms, legacy game, socket.io client
  auth/            Who is signed in (asked from the server on load), route guard
  components/      Board, hand, chips, game screen, UI primitives
  screens/         Sign in, sign up, lobby, table, hot-seat setup, server game
  styles/          Design tokens and global CSS
```

### GameAdapter

The game screen only talks to a `GameAdapter`: `getState`, `subscribe`, `legalTargets`, `playCard`,
`exchangeDeadCard`, `pass`, `refresh` and `dispose`.

- **`LocalGameAdapter`** wraps the rules engine. `src/engine/board-layout.json` is a verbatim copy of the backend's
  `data/board_deck.json`, and card names match the backend (`10-Heart`, `J-Spade`, `Blank`).
- **`RoomGameAdapter`** plays a table's game: `POST /room/:id/start`, then `GET /room/:id/game` and
  `POST /room/:id/game/{play,exchange,pass}`. It re-fetches on the `game_updated` socket event (plus a slow safety
  poll), and the server's reason for a refused move (for example "It's Sakib's turn.") is shown as is.
- **`RemoteGameAdapter`** implements the legacy test game's contract: it polls `GET /board/deck` and `GET /game/hand_cards` (there
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

## Accounts

Anyone can create an account at `/signup` (handle, display name, password). The server keeps accounts and
sessions in PostgreSQL, so a session survives backend restarts and lasts a week without use. On load the app asks
`GET /user/profile` who is signed in; nothing about the user is stored in the browser. "Sign out" ends the session
on the server.

## Tables and history

The server stores tables, seats, games and every move in PostgreSQL. The lobby's **Your tables** card
(`src/screens/YourTables.tsx`, from `GET /user/rooms`) lists the tables you opened or sat at with their status
(waiting, in progress with the move count, or who won) and links to resume or view them. The full move history of a
table is available from `GET /room/:id/turns`; the game screen's move log comes from the game view itself.

## Backend limitations

These are workarounds for the current backend. Details are in `../sequence-board-game/docs/known-issues.md`, and the
game-related ones are all in `src/game/remote/backendQuirks.ts`.

| Backend behaviour | What the frontend does |
|---|---|
| `room_updated` and `game_updated` go to every client | Pages ignore other rooms' `game_updated` and re-fetch their own room or game. |
| The legacy test game (`/game/*`) has no turn order, sequences, dead cards or win | `/server-game` is a developer tool, labelled as such. Real games run at a table (`/table/:id/game`). |
