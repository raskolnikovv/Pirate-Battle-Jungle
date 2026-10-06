# Pirate Battle

A 2D top-down naval shooter challenge built with React, TypeScript, and PixiJS.

## Install

```bash
npm install
```

First time running Playwright tests, install browser binaries:

```bash
npx playwright install chromium
```

## Development

```bash
npm run dev
```

App runs at `http://localhost:5173` by default.

## Build

```bash
npm run build
```

Production output goes to `dist/`. Preview it with:

```bash
npm run preview
```

## Scripts

| Script          | Description                                  |
| --------------- | -------------------------------------------- |
| `npm run dev`   | Start Vite dev server with HMR               |
| `npm run build` | Type-check then build for production         |
| `npm run preview` | Preview the production build locally        |
| `npm run typecheck` | Run TypeScript in noEmit mode             |
| `npm run lint`  | Run ESLint on `src/`                         |
| `npm run test`  | Run Playwright E2E tests (starts dev server) |

## High-Level Architecture

```
src/
├─ app/                  # App shell, providers, screen routing
├─ components/           # Shared presentational components (NavButton, ScreenLayout, GameCanvas)
├─ screens/              # Page-level React components (MainMenu, Game, Result, Ranking...)
├─ game/                 # Game logic: NEVER re-rendered by React every frame
│  ├─ core/              # Game, GameLoop, GameState contracts
│  ├─ entities/          # Player, Chaser, Shooter, Projectile factories
│  ├─ systems/           # Movement, Collision, Combat, Spawn processors
│  ├─ rendering/         # PixiJS renderer adapter
│  └─ input/             # Keyboard input manager
├─ api/                  # Axios client + endpoint functions
├─ hooks/                # TanStack Query hooks (useRanking, useHistory, useSubmitMatch)
├─ mocks/                # MSW fixtures, handlers, and browser worker
├─ config/               # Central GameConfig with placeholder tuning values
└─ types/                # Lightweight domain contracts (Player, Enemy, MatchResult, pagination)
```

### Separation of Concerns

- **React UI/Screens** own only menus, HUD overlays, and navigation. They do NOT render the game.
- **PixiJS (`components/GameCanvas.tsx` + `game/rendering/`)** owns the continuous rendering and canvas; React only mounts/destroys the PixiJS `Application`.
- **Game Simulation (`game/core/`, `game/systems/`, `game/entities/`)** owns mutable per-frame state and rules. It runs on the fixed-timestep `GameLoop` and is completely decoupled from React.
- **Input (`game/input/InputManager`)** maps keys to a snapshot consumed by the simulation, not by React directly.
- **Remote API state** flows through Axios → TanStack Query → React screens. The game simulation itself has no knowledge of network calls; match results are submitted from the UI after the simulation ends.

This separation ensures React does NOT re-render 60 times per second and lets a junior developer implement each system one at a time without touching the other layers.

### PixiJS Lifecycle (Strict Mode Safe)

`GameCanvas` uses `useRef` for the `Application` and a `cancelled` flag in `useEffect`. During Strict Mode's mount/unmount/remount cycle:

1. First effect begins init, cleanup sets `cancelled = true` and destroys any partial app.
2. Second effect begins init and checks `cancelled` before attaching to DOM.
3. On real unmount, the app is destroyed with textures.

### Mocked APIs

MSW browser worker starts automatically in development. Handlers:

- `GET /api/ranking?page&pageSize` → paginated leaderboard fixtures
- `GET /api/history?page&pageSize` → paginated match history fixtures
- `POST /api/matches` → echoes back a `MatchResult`

When the real backend is ready, remove the `worker.start()` block in `src/main.tsx` and set a real `VITE_API_BASE_URL` on the Axios client.
