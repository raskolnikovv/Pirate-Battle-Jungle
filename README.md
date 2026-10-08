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

### Physical-phone development (trusted HTTPS)

Plain `http://192.168.x.x:5173` is **not** a secure context. Unlike localhost,
it has no Service Worker support. However, installed MSW 3.0.2 automatically uses
its built-in Fetch/XHR fallback there, with the same handlers. This was verified
on an actual HTTP LAN origin; do not reject that working fallback based only on
`navigator.serviceWorker` being absent. The proven completion failure was instead
HTTPS-only `crypto.randomUUID()`, throwing before Result and preventing submission.
Match IDs now use a cryptographically random UUID-v4 fallback via `getRandomValues`
when needed. Local completion opens Result even if MSW startup or POST fails;
failed registration remains pending.
See [browser secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts)
and [randomUUID](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID).

For the next test you may still use `npm run dev -- --host 0.0.0.0` and open
`http://YOUR_PC_IP:5173`: this version's real MSW fallback supports the same flow.
**Recommended:** use Vite's native HTTPS support below to test the actual Service
Worker as well. HTTPS is required for that worker, not for MSW's fallback mode.
No extra application dependency or separate mobile API is needed.

1. Install [mkcert](https://github.com/FiloSottile/mkcert#installation) on the PC
   (Windows supports Chocolatey: `choco install mkcert`). Find the PC's current
   private IPv4 address using `ipconfig`. PC and phone must share the LAN.
2. In the repository's PowerShell terminal, replace `192.168.3.2` with that address:

   ```powershell
   mkcert -install
   New-Item -ItemType Directory -Force .cert
   mkcert -cert-file .cert/dev.pem -key-file .cert/dev-key.pem localhost 127.0.0.1 ::1 192.168.3.2
   mkcert -CAROOT
   ```

3. Install the CA's **rootCA.pem** as a trusted CA on the phone. A `.crt` copy may
   be needed for Android's certificate installer. Android's settings generally
   use Security → Encryption & credentials → Install a certificate → CA certificate;
   names vary by vendor. On iOS, install the certificate profile, then enable full
   trust under Settings → General → About → Certificate Trust Settings. Transfer
   only the public root certificate: **never transfer `rootCA-key.pem`**.
4. Start the HTTPS server:

   ```bash
   npm run dev:mobile
   ```

   Open **`https://192.168.3.2:5174`** on the phone (use your PC IP). Permit the dev
   server through the PC firewall if the phone cannot connect. The page must open
   with a trusted certificate, without a TLS warning. Merely bypassing a warning
   is insufficient to reliably register a Service Worker. Restart the browser
   after installing trust if necessary. Regenerate the certificate if the IP changes.

The script uses `vite --mode mobile --host 0.0.0.0 --port 5174 --strictPort`.
It fails clearly if certificates are missing. `.cert/` is ignored by Git.
Optional `DEV_HTTPS_CERT` and `DEV_HTTPS_KEY` in `.env.mobile.local` can select other
certificate paths; these variables are server-only, never exposed to application code.
Normal `npm run dev` and production build remain unchanged; actual Service Worker
registration in a published build also needs trusted HTTPS (or a trustworthy loopback origin).

Axios keeps relative `/api` URLs, and in worker mode MSW registers
`/mockServiceWorker.js` under the same origin. There is one completion/submission/query flow for desktop and phone.
Local storage belongs to each origin/browser: HTTP, HTTPS, localhost and the LAN IP
do **not** share options, results, pending submissions or confirmed records. This is
a browser-local mock, not a shared network database; desktop records are not copied
to the phone. Existing HTTP data is not migrated to HTTPS. Test a new match on HTTPS,
then verify **Registration: Submitted**, Ranking and Match History in that browser.

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
| `npm run dev:mobile` | Start trusted HTTPS LAN server on port 5174 |
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

## Mobile gameplay controls

Touch-capable devices (`any-pointer: coarse`) show a virtual joystick and three
attack buttons. Pointer-only desktop layouts retain keyboard instructions and hide
these controls; hybrid devices can use both input sources.

- Point the joystick anywhere around 360 degrees to choose a travel heading. The
  ship takes the shortest gradual turn at its existing configured rotation speed,
  sailing forward along its current bow while turning. Down means turn toward the
  bottom and sail there, never reverse. A radial 22% dead zone stops touch movement;
  joystick magnitude outside it controls a fraction of the configured sailing speed.
  Alignment tolerance is 0.01 radians to avoid tiny steering corrections.
- Keyboard W/Up still means full-speed forward; A/Left and D/Right still turn at
  the configured speed. On hybrid devices, explicit keyboard steering takes priority
  over touch heading, and W/Up takes priority over touch throttle.
- Hold **Front shot**, **Left broadside**, or **Right broadside** to fire using the
  existing weapon cooldowns (Space/Q/E equivalents). Multiple fingers may steer and
  attack simultaneously. Attack buttons also accept held Space/Enter when focused.
- Releasing/canceling a pointer clears that source only. Pause, focus loss, hidden
  tab, orientation/size change and leaving the match discard touch holds. Resume
  requires fresh input. Keyboard bindings remain W/Up, A/Left, D/Right, Space, Q, E.
- Portrait and landscape are supported. On coarse-pointer landscape phones up to
  500px tall, a single compact HUD row reserves about 49px. At widths of 700px or
  more, a centered three-region grid places the joystick just left of the arena
  and three vertically stacked attacks just right. The grid is capped by available
  height so controls stay nearby, without covering the playable canvas. Narrower
  landscape and portrait layouts place controls below the arena. Canvas scales
  within its own region, retaining its 960×600 logical world and aspect ratio.
  Safe areas and dynamic viewport height are respected; gameplay does not scroll.
  The joystick group is vertically centered on the arena, excluding the HUD.
- The joystick has only a base ring and movable knob, with **Drag to steer** as
  its helper. No three-direction arrows are used for the 360-degree control.
- Round buttons and firing icons come from the official `ui/controls` PNG assets.
  The joystick uses CSS; it does not replace required gameplay assets.

Focused Chromium touch tests:

```bash
npx playwright test tests/touchControls.spec.ts --workers=1
```

Tests use browser touch events with multiple IDs and advance the real simulation
in fixed steps. Real iOS/Android hardware ergonomics and Safari are still manual
validation tasks; no orientation lock or full mobile menu redesign is included.

LAN regression tests (plus same-origin API coverage):

```bash
npx playwright test tests/mobileLan.spec.ts --workers=1
```

Three tests start a temporary HTTP Vite server on the machine's private LAN IPv4
address and exercise real insecure-context restrictions, not mocked Service Worker
support. They skip when no private LAN address is available. Both timer and death
completion must show Result, submit through MSW's actual fallback and appear in
Ranking/History after refresh. A separate forced worker-start failure must show
Result and preserve pending submissions across refresh.
The localhost test verifies submission, ranking and history request the current origin.

## Fixture semantics

The normal **Success** baseline seeds three sample matches belonging to the current
mock player (`Captain`) and eight competitor matches with pirate display names.
Ranking includes compatible fixtures and confirmed matches, filtered by the full
GameConfig key. With default settings and no confirmed records there are 11 entries;
custom settings can exclude all default-config fixtures. Match History filters by
the requested player ID: the UI always requests the local player's history, never
the competitors' personal histories. It starts with three local sample matches and
adds that player's confirmed matches regardless of their configuration.

Internal player IDs remain stable in API records but are not shown as display names.
Ranking displays pirate names and marks the current player **You**. The **Multiple
pages** scenario adds 15 local-player records to responses only; they are not saved
as confirmed records and disappear when returning to Success. **Reset network demo**
restores Success targeting all endpoints and clears confirmed/pending records while
preserving Options and the last local result. It intentionally keeps the baseline
fixtures. Separate phone/desktop origins can have different saved options, scenarios
and confirmed records; those local stores are not synchronized.

Reset also cancels Ranking/History requests, removes their cached pages and resets
registration status. Merely invalidating inactive queries retains deleted rows until
a successful refetch; removal ensures the next screen fetches fresh data without
showing a previously played match, even if that request fails. Reset feedback reports
incomplete persistence when local data or scenario selection cannot be saved.
With default 120s/3s settings, clean Success has 11 Ranking entries and 3 local History
samples. With saved 60s/3s settings, Ranking has no matching baseline fixtures, while
History still has the 3 samples: **Reset preserves Options**.


## Reproducible production profiling

Run separately from other browser tests and heavy background tasks:

```sh
npm run build:profile
npm run profile
```

This uses optimized Vite output served by `vite preview` on `127.0.0.1:4173`.
Do not start another server on that port. The separate Playwright configuration runs
one desktop Chromium worker with real wall time, a 180-second match, and five
10-second start/play/Quit Match cycles. Gameplay is never accelerated or made invulnerable.
The pilot follows a water route, aims toward observed enemies with slow forward throttle,
and supplies normal touch-direction/attack intentions; seed and balance stay unchanged.
The long run uses the valid 15-second spawn option for reproducible survival; cycles use
standard 3-second spawning. A death before 180 active seconds fails the long-run test.
To experiment with the standard workload in PowerShell, set
`$env:PROFILE_SPAWN_SECONDS = '3'` before `npm run profile`; remove it afterward with
`Remove-Item Env:PROFILE_SPAWN_SECONDS`. Early death remains an incomplete run.

`PERFORMANCE_REPORT.md` and `profiling-results/*.json` contain measurements, hardware,
browser, build hash, frame intervals, entity history, and cleanup counts. Previous runs
are archived locally under `profiling-results/attempts/`; HTML/traces are generated
under `profiling-results/html/` and `profiling-results/traces/`. Setup failures do not
reuse previous JSON as current measurements. The report is generated even when tests fail.
Audio buffers and one shared AudioContext intentionally remain cached between screens.
Heap samples use requested CDP garbage collection and are not GPU/whole-process memory.

Profiling hooks are enabled only by `.env.profiling` (`VITE_PROFILING=true`), with bounded
buffers and no per-frame React updates. For normal delivery, run `npm run build` again;
the normal build omits the profiling module. `Show FPS` remains available independently.
Headless desktop results are not physical-mobile or display-presentation measurements.
To measure visible Chrome locally, use `$env:PROFILE_HEADED = '1'` in PowerShell
before `npm run profile`. Keep that window focused for the whole run; changing tabs
correctly auto-pauses the game and invalidates the uninterrupted measurement.
Inspect the recorded GPU backend: SwiftShader is software rendering, not evidence
of native GPU performance. Remove the variable afterward with
`Remove-Item Env:PROFILE_HEADED`.
