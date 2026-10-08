# Pirate Battle

Single-player, top-down naval shooter built for the Jungle Gaming Junior React challenge. Sail around islands, fight Chasers and Shooters, and earn **1 point per enemy destroyed by player attacks**. Chaser contact/self-destruction awards **0 points**. Matches end when time expires or the player's HP reaches zero.

## Implemented features

- Fixed 960×600 arena with coastal cover and an isolated island that block ships and shots.
- Forward movement, rotation, front cannon and independent three-projectile broadsides.
- Seeded spawning, Chaser pursuit/contact damage and ranged Shooter attacks.
- Health bars, damaged ship artwork, firing/impact/explosion effects and projectile trails.
- Manual/automatic pause, responsive touch joystick and simultaneous movement/attacks.
- Pirate-themed menus, Options, Result, Ranking and Match History.
- Semantic HTML HUD, accessible controls and managed dialog focus.
- Official WAV effects, UI sounds and ocean ambience with persistent preferences.
- Paginated mock API, persistent confirmed records and pending submissions with explicit retry.

**Stack:** React 19, strict TypeScript, PixiJS 8, Vite 8, TanStack Query 5, Axios, MSW 3 and Playwright. Exact versions are in [package-lock.json](package-lock.json).

## Getting started

Use **Node.js 22.13+ in the 22.x line**, or Node.js 24+. MSW requires Node ≥22.12; ESLint requires ≥22.13 in the 22.x line. Node 20 is unsuitable for this dependency set. The recorded local environment uses **22.23.2**; the repository does not pin Node with `engines` or `.nvmrc`.

```bash
npm ci
npm run dev
```

Development defaults to `http://localhost:5173`. No API credentials or external backend are required.

```bash
npm run build
npm run preview
```

The build writes `dist/`; preview normally serves `http://localhost:4173`. Preview is a local production-build check, not a deployment service.

### Environment and MSW initialization

[src/main.tsx](src/main.tsx) awaits `ensureMockWorkerReady()` before mounting React. MSW is intentionally enabled in **development and production**. Axios also verifies interception before requests. The committed [public/mockServiceWorker.js](public/mockServiceWorker.js) is copied to the build; preserve it when publishing.

No `.env` is required for normal development/build. Optional settings:

| Setting | Purpose |
| --- | --- |
| `DEV_HTTPS_CERT`, `DEV_HTTPS_KEY` | Server-only certificate paths in `.env.mobile.local`; defaults `.cert/dev.pem` and `.cert/dev-key.pem`. |
| `VITE_PROFILING=true` | Profiling hooks; supplied by `.env.profiling` for `build:profile`. Keep disabled for normal delivery. |

### Physical-phone development

Connect phone and PC to the same LAN. `npm run dev -- --host 0.0.0.0` supports HTTP LAN testing; MSW 3 uses its Fetch/XHR fallback where Service Workers are unavailable.

For trusted HTTPS and the actual Service Worker, install **mkcert**, replace the sample IP with your PC's IPv4 address, and run in PowerShell:

```powershell
mkcert -install
New-Item -ItemType Directory -Force .cert
mkcert -cert-file .cert/dev.pem -key-file .cert/dev-key.pem localhost 127.0.0.1 ::1 192.168.3.2
mkcert -CAROOT
npm run dev:mobile
```

Trust the CA's public `rootCA.pem` on the phone, then open `https://192.168.3.2:5174`. Never transfer the CA private key. `.cert/` is ignored; missing certificates cause startup to fail clearly. Regenerate certificates when the IP changes. HTTP/HTTPS, localhost/LAN IP and different browsers have **separate local storage**.

Menu images are decoded before navigation becomes available, with an accessible progress bar and retry on failure. Starting a match loads gameplay textures separately; both loading stages use the menu background. Progress counts resources, not downloaded bytes. UI sounds require the first trusted click/key gesture; hover alone cannot unlock browser audio.

## Controls

| Keyboard | Action |
| --- | --- |
| W / ArrowUp | Move forward |
| A / ArrowLeft | Rotate left |
| D / ArrowRight | Rotate right |
| Space | Front cannon: one projectile |
| Q | Left broadside: three parallel projectiles |
| E | Right broadside: three parallel projectiles |

Hold attacks to fire when cooldown allows. Movement and attacks can be combined. Focused buttons/editable controls keep native keyboard behavior; Space and Enter can activate buttons.

**Touch:** coarse-pointer devices show a left joystick for desired travel direction. The ship turns progressively through the shortest angle and sails forward with analog intensity, without reversing or snapping. Hold attack buttons with another finger. Portrait and landscape are supported.

Use **Pause → Resume** to continue explicitly. Blur/hidden tab pauses automatically; returning never resumes automatically. Pause freezes simulation time, weapons, enemies, spawning and effects/trails. Resume focuses the arena. Closing in-game Options leaves the match paused. **Quit Match / Main Menu** abandons without registering; **Play Again** creates a fresh match.

## Game configuration

| Option | Default | Limits / behavior |
| --- | --- | --- |
| Game session time | 120 seconds | 60–180 seconds; validate and save with Save. |
| Enemy spawn time | 3 seconds | 1–15 seconds; validate and save with Save. |
| Audio | Unmuted | Mute; effects 60%, ambience 25%; changes apply immediately. |
| Show FPS | Off | Persistent toggle; gameplay display updates approximately once per second. |

Spawn bounds allow at most one scheduled attempt per second and at least four scheduled attempts in the shortest match. An attempt may fail if no safe position exists; the interval does not guarantee enemy counts.

Main Menu Options shows all settings. Paused-match Options shows only audio and Show FPS. Duration/spawn changes affect **new matches only**: the Game screen reads saved options once and `Game.start()` copies its typed `GameConfig`, including nested tuning. Play Again creates another snapshot. Invalid stored options fall back to defaults. Audio/display preferences are separate from gameplay configuration.

## Mock API and network scenarios

Axios calls relative `/api` endpoints; TanStack Query owns lists/cache. This is a **browser-local mock**, not an authenticated shared ranking service.

| Endpoint | Behavior |
| --- | --- |
| `POST /api/matches` | Persists confirmed matches before acceptance; same ID/payload is idempotent, conflicting payload returns 409. |
| `GET /api/ranking` | Pages records matching the entire configuration selected by saved Options. |
| `GET /api/history` | Pages confirmed records for the local player. |
| `GET /api/mock-status` | Interception readiness probe. |

Both list screens request 5 items per page. Ranking orders score descending, active duration ascending, completion date ascending, then match ID ascending. History starts empty for a new local player and shows confirmed matches only (the Multiple pages demo scenario adds temporary sample records). History orders newest completion first, then match ID ascending. Ranking is **per match**, not each player's aggregated best score. Other captains are fixtures; custom configurations can exclude all default-config fixtures.

Completed matches enter pending local storage **before** POST. Only a validated API confirmation marks success and invalidates Ranking/History. Failures retain manual **Retry registration**, including after refresh. Retry after server acceptance recovers the same record without duplication. Last Result is restored separately; its session registration label is not a durable receipt. Refresh neither restores active gameplay nor silently sends pending records.

Expand **Development / demo network scenarios** on Main Menu or Result. Choose a scenario and target (`all`, `ranking`, `history`, `matches`):

- Success, Empty lists, Multiple pages.
- Slow responses (1.5 s), Variable latency, Out-of-order responses.
- Timeout before confirmation, Connection error, HTTP 422, HTTP 500.
- Ranking failure only, History failure only.
- Timeout after confirmation, API unavailable at match end.

Selection persists; request sequences restart on selection/reload. Axios timeout is 10 seconds; timeout scenarios delay 11 seconds. GET queries retry once; POST never retries automatically. Cached data can remain visible alongside a refetch error.

**Reproduce recovery:** select API unavailable at match end, complete a match, inspect pending status, refresh, select Success and retry. For idempotency, use Timeout after confirmation: retry must recover one record. For delayed pages, select Out-of-order responses and change pages.

**Reset network demo** restores Success/initial fixtures, clears confirmed/pending mock records and relevant query state. It preserves Options and last Result. Selection/reset are disabled during submission; storage failures are reported. Multiple pages adds response-only fixtures.

## Quality and testing

```bash
npm run typecheck
npm run lint
npm run build
npx playwright install chromium
npm test
npx playwright show-report
```

The normal suite owns a development server on `127.0.0.1:5175`, uses Chromium with two local workers (one in CI), and retains failure traces. Browser contexts isolate tests. Deterministic boundary tests control simulation time while exercising real systems/inputs; they are not performance measurements.

Versioned visual baselines under `tests/*.spec.ts-snapshots/` include desktop, mobile portrait and landscape. Review intended appearance changes before updating them. The latest recorded full run passed **164 tests**, followed by **42 successful stability executions** of previously failing cases. These are recorded results from the preceding regression validation, not a new run for this documentation change. Generated HTML/failure traces are ignored by Git and must be delivered separately.

### Production profiling

```bash
npm run build:profile
npm run profile
npm run build
```

Profiling uses a separate configuration, production preview on 4173, a real-time survival attempt and five start/play/exit cycles. The final normal build removes profiling hooks. Default profiling archives prior raw runs and regenerates `PERFORMANCE_REPORT.md`; choose a separate directory to preserve published measurements.

Native-backend verification on Windows, with full Chromium installed:

```powershell
node profiling/probe-gpu.mjs
npm run build:profile
$env:PROFILE_CHANNEL = 'chromium'
$env:PROFILE_REQUIRE_GPU = '1'
$env:PROFILE_EVIDENCE_DIR = 'profiling-results/local-native'
Remove-Item Env:PROFILE_SPAWN_SECONDS -ErrorAction SilentlyContinue
Remove-Item Env:PROFILE_ALLOW_EARLY_EXIT -ErrorAction SilentlyContinue
npm run profile
npm run build
```

Required-GPU mode rejects software fallback. Custom output directories receive JSON/HTML without rewriting the main report. Avoid simultaneous profiling/regression runs. See [PERFORMANCE_REPORT.md](PERFORMANCE_REPORT.md) for exact hardware, workload variants, measurements and manual DevTools instructions.

## Project structure

| Path | Responsibility |
| --- | --- |
| `src/app`, `src/screens`, `src/components` | React navigation, forms, dialogs, HUD and touch UI. |
| `src/game` | Core simulation, entity records, systems, input, assets and Pixi rendering. |
| `src/audio` | Asset manifest, shared Web Audio and UI sound routing. |
| `src/config`, `src/storage` | Typed configuration, preferences and local persistence. |
| `src/api`, `src/hooks`, `src/mocks` | Axios contracts, Query hooks and MSW scenarios/fixtures. |
| `tests`, `profiling`, `profiling-results` | Regression tests, production harness and recorded JSON evidence. |
| `public/assets` | Supplied Jungle artwork/sounds and supplemental menu artwork. |

Read [ARCHITECTURE.md](ARCHITECTURE.md) for the technical design.

### Development approach

Development proceeded in incremental milestones. The project owner provided step-by-step requirements, reviewed each stage and supplied feedback from manual desktop and physical-phone testing. Implementation and technical documentation used AI assistance; this does not imply that every part was written manually.

## Known limitations

- No cross-device backend, authentication or live cross-tab synchronization. Persistence depends on browser/origin storage.
- Enemy AI uses pursuit, coastal collision resolution and a small-island detour, not general pathfinding. Circle colliders approximate land artwork.
- Rendering uses current positions; the loop's interpolation parameter is unused.
- Audio needs a trusted user gesture; unavailable audio does not block gameplay.
- Vite reports a main chunk above 500 kB (approximately 1.05 MB uncompressed): a loading warning, not proof of gameplay frame-rate failure.
- Native headless AMD/D3D11 **light** 180-second profiling measured approximately 100 FPS/10.60 ms p95. Standard/dense attempts ended by death; neither proves three-minute dense-combat performance. Historical SwiftShader measured 15.68 FPS/66.90 ms. These are environment-specific, not physical-phone or universal benchmarks.
- Owned-resource cleanup checks passed, but approximately 1 MB post-GC heap growth remains inconclusive without longer retainer analysis.
- Public deployment and complete source/license documentation for supplied/supplemental assets have not been verified and remain delivery checks.

## Deployment

Publish normal `npm run build` output (`dist/`) on a static host with trusted HTTPS. No real `/api` server is required for this mock challenge. No public deployment URL is currently documented or verified.

Navigation uses React screen state, not path routes; only Result uses `#result`. Serve `index.html` for the root/SPA fallback, serving actual files first. Preserve `/mockServiceWorker.js` as JavaScript with adequate worker scope, `/assets/` and built module paths. Never rewrite the worker request to HTML.

Paths are origin-absolute: **deploy at the domain root**. Subdirectory hosting needs coordinated path/base changes, not only Vite's base. Verify assets, gameplay, Ranking, History, submission/retry and refresh on the published origin. Include generated test reports and profiling evidence; ignored local reports are not present in a clean checkout.

### Netlify publishing

No Netlify plugin, functions, `netlify.toml` or `_redirects` file is required for the current app. Navigation keeps the root path and uses only the Result hash, so refreshing does not require path-route rewrites. If clean path routes are introduced later, reassess SPA rewrites. See [Netlify's Vite guide](https://docs.netlify.com/build/frameworks/framework-setup-guides/vite/).

For Git-based publishing:

1. Import the repository into Netlify and select the delivery branch.
2. Use the repository root as the base directory, `npm run build` as the build command and `dist` as the publish directory.
3. Set build environment `NODE_VERSION=22.23.2` (the tested version) and `VITE_PROFILING=false`. Leave `NODE_ENV` unset during dependency installation: Vite/TypeScript are devDependencies required to build. No API secrets are required. See [Netlify dependency configuration](https://docs.netlify.com/build/configure-builds/manage-dependencies/).
4. Publish at the site's HTTPS origin root. Preserve the entire `dist` output; do not upload only `index.html` or only `public`.
5. On the published URL, check `/mockServiceWorker.js` returns JavaScript, then test Start Game, Ranking, Match History, completion/submission and refresh on `/#result`. Also test pending/retry and a physical phone on that origin. Records from localhost will not transfer to the new origin.

Alternatively, run `npm ci` and `npm run build` locally, then use Netlify's manual deploy to upload the complete `dist` folder. Manual deployment does not execute a build command; see [Netlify deploy documentation](https://docs.netlify.com/deploy/create-deploys/).

Local readiness verification used Windows, Node 22.23.2 / npm 11.12.1 and a fresh archive of revision `ec47e8f`: locked installation and production build passed without existing node_modules/dist. All 520 tracked public files, including the worker, were copied unchanged; all 66 referenced asset paths were present. Chromium verified MSW Ranking/History, a natural 60-active-second keyboard-played match with automatic POST 201, refresh persistence and idempotent POST 200 without duplication. The fresh-checkout build also passed a separate browser smoke check, replaying that completed-match payload. No uncaught page errors occurred. This verifies local production preview, not a remote Netlify/Linux build or published HTTPS site. The existing large-chunk warning remains; no deployment was performed.
