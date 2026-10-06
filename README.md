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

MSW browser worker starts automatically in development and production. Handlers:

- `GET /api/ranking?page&pageSize&configKey` → paginated matches with the same full configuration
- `GET /api/history?page&pageSize&playerId` → paginated player matches, newest first
- `POST /api/matches` → persist a completed match; repeat IDs return the existing identical record or conflict with 409

The current API is simulated entirely in the browser. Confirmed records and pending
submissions persist locally; retries keep the original match ID and configuration.

## Demo network scenarios

MSW runs in development and production. On Main Menu or Match Results, expand
**Development / demo network scenarios** and select a scenario and target endpoint.
Normal behavior is **Success**. The selection is stored under
`pirate-battle:network-scenario:v1`; refresh preserves it and restarts request counters.
Invalid or unavailable scenario storage falls back to Success.

Available scenarios: Success, Empty lists, Multiple pages, Slow responses,
Variable latency, Out-of-order responses, Timeout before confirmation,
Connection error, HTTP 422, HTTP 500, Ranking failure only, History failure only,
Timeout after confirmation, and API unavailable at match end.

- Target limits a scenario to Ranking, Match History, Match submission, or all.
  Empty lists and Multiple pages affect GETs only. Endpoint-specific failures
  affect only their named GET. Timeout after confirmation affects POST only.
- Slow uses 1,500ms. Variable latency repeats 150/700/300/100ms per endpoint.
  Out-of-order alternates 1,500/100ms, so concurrent requests finish later-first.
  Selecting a scenario restarts counters. Query keys retain configuration/player/page;
  TanStack Query cancellation reaches Axios when leaving a screen.
- Multiple pages adds 15 deterministic response-only matches, never persisted.
  Ranking fixtures use the requested valid configuration; History fixtures use defaults.
- Axios times out at 10 seconds; timeout scenarios delay 11 seconds. Before-confirmation
  timeout never accepts a new POST. After-confirmation timeout saves first, then delays.
  Choose Success and **Retry registration** to recover the same ID without duplication.
- For an outage demo, select API unavailable, complete a match, observe its pending status,
  and start another match or return to Main Menu. Choose Success and retry explicitly.
- **Reset network demo intentionally deletes all confirmed and pending matches**, restores
  initial fixtures, Success, counters and registration/query state. Options and the last
  local result remain. The result then has no confirmed registration in this session.
  Reset/selection is disabled during submissions. Blocked storage reports incomplete reset;
  this is not a transactional reset across browser storage keys or tabs.
- `/api/mock-status` is always healthy: simulated API failures do not disable MSW transport
  recovery or gameplay. GET retries retain the existing TanStack Query policy; POST retries
  are explicit. Slow/timeout delays are asynchronous and do not block the main thread.

Focused runtime regression suite:

```bash
npx playwright test tests/networkScenarios.spec.ts tests/pendingMatches.spec.ts tests/confirmedMatches.spec.ts tests/ranking.spec.ts --workers=1
```

Timeout tests shorten only Axios's client timeout to 300ms; the real shared MSW scenario
still uses 11 seconds. Concurrent ordering tests use the real shared handlers.
