# Pirate Battle production performance report

> Historical baseline: the original sections describe SwiftShader. See the Native GPU verification section below for new hardware measurements and their limitations.

## Environment and reproducibility

- Measurement date: 2026-10-08T14:17:35.085Z
- OS: Windows_NT 10.0.26100 x64
- CPU: AMD Ryzen 5 4600G with Radeon Graphics; 12 logical processors
- RAM: 15.39 GiB
- Chromium: 153.0.8010.12; headless desktop automation
- Screen / viewport / DPR: {"viewport":{"width":1280,"height":900},"screen":{"width":1280,"height":900},"devicePixelRatio":1}
- Git commit: 0c724afdc6d887beddc39487e6245196b5ffb781 (working tree changes included; see JSON gitStatus)
- Optimized profiling build JS SHA-256: af905cfcde876fc7a5d57e809eecc229a4baccfb47d8fff2802e6e61ef0f2bf9
- Graphics backend: [{"vendorId":65535,"deviceId":65535,"subSysId":0,"revision":0,"vendorString":"Google Inc. (Google)","deviceString":"ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver-5.0.0)","driverVendor":"SwANGLE","driverVersion":"5.0.0"}]; full driver/feature information in JSON.
- No physical mobile measurements. Headless Chromium/GPU scheduling may differ from normal Chrome.

Commands (repository root):

```sh
npm run typecheck
npm run lint
npm run build:profile
npm run profile
npm run build
npm test -- --workers=2
```

The profiling command starts its own Vite preview on 127.0.0.1:4173, with no development server. Production assets and MSW status are checked. The test uses Options to set duration 180 seconds and spawn interval 15 seconds. All other balance and seed values are unchanged; the full GameConfig is in session.json. An automated pilot follows a water route between enemies, aims gradually at the nearest enemy while approaching slowly, and uses the same public input intentions as touch, with all three weapons held. No HP/entity/clock mutations, accelerated time, disabled damage or invulnerability. A real 200 ms wait samples input; the game uses its own RAF and fixed simulation loop.

## Real gameplay measurement

Profiling procedure exit code: 0 (0 means both test assertions passed).
An earlier standard 3-second spawn attempt ended by death after 52.08 active seconds (51.70 observed wall seconds), with 15.69 average FPS. This earlier orbit-only pilot run is incomplete and retained separately in default-spawn-early-ending.json; its pilot strategy differs from the final aiming pilot, so these attempts are not controlled benchmark comparisons. The recorded run uses the valid 15-second Options interval. This is a lighter workload and does not establish sustained performance under standard/dense spawning.

- Complete three-minute run: **YES**
- Observed wall time: 180.33 s
- Active simulation time: 180.00 s
- Ending: time_expired
- Final HP / score / shots created: 30 / 11 / 1685
- Average rendered FPS: **15.68**
- Minimum interval-derived FPS (single longest interval): 2.61
- Low 1% interval-derived FPS (1000 / p99 interval): 14.53
- p95 inter-render frame time: **66.90 ms**
- Frame intervals: 2825; dropped samples: 0
- Maximum enemies / projectiles / all entities at render observation: 1 / 13 / 17
- Runtime errors: []

FPS is render completions divided by measured inter-render time. It is NOT the fixed 60 Hz simulation tick rate, GPU presentation time, or CPU render cost. Entity history is sampled once per second; maxima are tracked at every completed render (entities created and removed entirely between renders are not observed). Total entities includes player and static islands; effects are represented in Pixi display-object diagnostics. Raw frame intervals and timestamped entity samples are bounded and exported. The observer measures actual renders, not an extra RAF running beside the game. Configuration and spawn seed are repeatable; wall-clock scheduling and input sampling can still change exact combat outcomes between runs.

## Five-cycle cleanup

Each cycle uses the standard 3-second spawn interval and plays for approximately 10 real seconds with movement, attacks and normal spawning, exits through Quit Match, waits for canvas removal, and requests CDP garbage collection before measuring. During/after values and selected window/document listener counts are saved in cycles.json.

| Cycle | Wall s | Post-GC JS heap bytes | DOM nodes | CDP listeners | Game / canvas / Pixi objects / owned textures after exit | Audio contexts / SFX / ocean / buffers |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 10.49 | 7594380 | 404 | 182 | 0 / 0 / 0 / 0 | 1 / 0 / 0 / 12 |
| 2 | 10.40 | 7933644 | 402 | 182 | 0 / 0 / 0 / 0 | 1 / 0 / 0 / 12 |
| 3 | 10.23 | 8211144 | 403 | 182 | 0 / 0 / 0 / 0 | 1 / 0 / 0 / 12 |
| 4 | 10.15 | 8395312 | 402 | 182 | 0 / 0 / 0 / 0 | 1 / 0 / 0 / 12 |
| 5 | 10.22 | 8571880 | 403 | 182 | 0 / 0 / 0 / 0 | 1 / 0 / 0 / 12 |

Post-cleanup scalar checks also verify that the referenced Pixi objects/textures were actually destroyed and Game state cleared; references are released synchronously. Post-GC heap delta from first to fifth exit: 977500 bytes. Any monotonic trend needs longer idle/retainer analysis; stable owned-resource/listener counts alone do not rule out all retained caches or browser allocations. No leak is asserted or ruled out from these five heap numbers.

Reported Pixi objects/textures are application-owned live resources, not GPU VRAM, Pixi internal caches, or all native objects. One shared AudioContext and decoded buffer cache are intentional across screens. CDP listener and DOM totals include React/MSW/browser activity, not only game listeners. Heap variability alone is not evidence of a leak; resource teardown assertions and trends should be considered together. Measurements exclude MSW worker heap, browser process RSS and GPU memory. Forced-GC snapshots assess retained JS resources rather than natural-GC peaks.

## Regular validation (recorded separately)

- npm run typecheck: exit 0
- npm run lint: exit 0
- npm run build:profile: exit 0
- npm run profile: exit 0, 2 passed (4.3 minutes)
- npm run build: exit 0
- npm test -- --workers=2: exit 0, 160 passed (5.2 minutes)

Recorded at: 2026-10-08T14:28:43.705271+00:00. Full regression HTML: playwright-report/index.html. The regular regression harness uses the development server; the separate performance procedure uses optimized production preview. Static inspection confirmed the normal production artifact contains neither pirateProfile nor profileSession. Warnings: Vite chunk above 500 kB (main normal-build chunk 1049.71 kB); NO_COLOR ignored because FORCE_COLOR is set.

## Assessment and limitations

This recorded run used SwiftShader software rendering, as verified in environment.graphics. Its frame rate is not native GPU performance; no GPU/device claim can be inferred from CPU model alone. Use PowerShell `$env:PROFILE_HEADED = '1'` then `npm run profile` to rerun in visible Chrome locally, keeping the window focused; inspect the newly recorded backend.

- Original three-minute requirement: measured on the documented desktop environment.
- Five-cycle requirement: five cycles measured; inspect resource assertions and JSON trends.
- 60 FPS target: average cadence falls below target in this environment; investigate before claiming compliance.
- No speculative optimizations or gameplay changes were made. Existing Vite chunk-size warning (>500 kB) concerns delivery/loading, not proof of a combat frame-rate failure.
- Profiling-only module is enabled by VITE_PROFILING=true in .env.profiling; normal npm run build removes its import path. Show FPS remains independent. Buffers are capped at 100,000 intervals and 1,000 entity samples.
- Run without other browser tests or heavy background tasks. Physical mobile and visible Chrome require separate validation; this report does not establish their performance.

## Files involved

Modified: .gitignore, package.json, README.md, DEV_NOTES_PTBR.md, src/audio/AudioManager.ts, src/components/GameCanvas.tsx, src/game/core/Game.ts, src/game/core/GameLoop.ts.
Created: .env.profiling, playwright.profile.config.ts, src/game/profiling/profileSession.ts, profiling/production.spec.ts, profiling/run.mjs, profiling/report.mjs, PERFORMANCE_REPORT.md, profiling-results/session.json, profiling-results/cycles.json, profiling-results/validation.json, profiling-results/checks.json, profiling-results/default-spawn-early-ending.json, profiling-results/orbit-early-ending.json.
Generated HTML/traces and archived attempts are ignored by Git. Existing focus styling in src/index.css was preserved; it predates this task. No gameplay balance, API contracts, Master Checklist, commits or pushes changed.

Evidence: [session JSON](profiling-results/session.json), [cycle JSON](profiling-results/cycles.json), [profiling HTML](profiling-results/html/index.html). Failed runs retain traces in profiling-results/traces. These measurements describe the hashed build, not later code changes.

## Native GPU verification and workload review (2026-10-08)


The earlier sections above are historical software-rendering measurements and checks, not results for the current build. Original session/cycle JSONs remain unchanged. New measurements use optimized production preview with full Chromium via PROFILE_CHANNEL=chromium, headless desktop, 1280x900, DPR 1. They are neither physical-mobile measurements nor visible-window Chrome measurements.

### Verified backend and cause of SwiftShader

GPU probe: [raw devices, feature status and launch arguments](profiling-results/gpu-probe.json). Default Playwright launches chrome-headless-shell.exe; its observed command line includes --use-angle=swiftshader-webgl. Full Chromium headless, both automatic backend selection and explicit D3D11, identified AMD Radeon Graphics via Direct3D11 with WebGL/compositing enabled. The Windows adapter reports driver 31.0.21923.1000, 1920x1080 at 100 Hz; the browser viewport remains 1280x900. See windows-gpu.json. Merely allowing --enable-unsafe-swiftshader is not proof of software rendering: that fallback permission also appears in the hardware run. Actual canvas UNMASKED_RENDERER_WEBGL and CDP SystemInfo are the verification criteria.

Native gameplay canvas: **ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001636) Direct3D11 vs_5_0 ps_5_0, D3D11)**. Combat canvas: **ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001636) Direct3D11 vs_5_0 ps_5_0, D3D11)**. Both runs require recognized hardware plus enabled WebGL/compositing before measurement. GPU-process crash counts and driver metadata are recorded in each JSON. This establishes successful native acceleration in these runs; it does not guarantee every machine/session behaves identically.

### Measurements and representativeness

| Environment / workload | Spawn s | Wall / active s | Ending | Mean FPS | p95 ms | Intervals | Max enemies / projectiles / total entities |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Historical SwiftShader, light | 15 | 180.33 / 180.00 | time_expired | 15.68 | 66.90 | 2825 | 1 / 13 / 17 |
| Native AMD D3D11, light | 15 | 180.05 / 180.00 | time_expired | 99.99 | 10.60 | 17991 | 1 / 14 / 18 |
| Native AMD D3D11, standard combat | 3 | 112.51 / 112.48 | defeated | 100.00 | 10.50 | 11239 | 1 / 15 / 20 |
| Native AMD D3D11, dense combat | 1 | 27.59 / 27.57 | defeated | 100.01 | 10.60 | 2750 | 3 / 12 / 18 |

Native light run completes 180 seconds: **YES**. Standard combat completes 180 seconds: **NO; early death is an incomplete three-minute measurement**. Low 1% interval-derived FPS: native light 92.59, combat 91.74. Single longest-interval FPS: 40.98 / 51.55. Runtime errors: [] / []. Finals: light HP 40, score 11; combat HP 0, score 34.

Previous maximum of one enemy was not a concurrency cap. SpawnSystem creates one enemy per interval, with no one-enemy limit. Previous interval was 15 seconds, and the aiming pilot held all weapons. Only 19 of 177 one-second samples had live enemies; they were removed before the next interval. The final had 11 defeated enemies and one survivor. This is a survival/light-load benchmark, not standard dense combat. The new standard run uses the same pilot and normal 3-second Options interval. It still peaked at one enemy because the pilot eliminated targets rapidly. A third native run uses the valid 1-second Options minimum and peaks at 3 enemies / 12 projectiles / 18 entities, ending after 27.57 active seconds (defeated); this is a short dense-combat observation, NOT a complete three-minute dense benchmark. Its low 1% interval-derived FPS is 88.50, minimum interval-derived FPS 67.11, final score 22, runtime errors []. See [dense session](profiling-results/native-gpu-dense/session.json), including actual renderer verification. Damage, spawning, movement, collision, cooldown and clock rules are unchanged; early death is recorded, not repaired by changing HP.

These are workload/environment comparisons rather than an isolated GPU A/B experiment: the previous JS build differs (subsequent UI audio/background changes), and real input scheduling changes outcomes. Render cadence is measured after actual renders, not the fixed 60 Hz simulation or monitor presentation. The observed approximately 100 FPS cadence is compatible with the Windows-reported 100 Hz display; headless presentation behavior still differs from a visible window. Playwright records a trace during the run (retained only on failure), so instrumentation overhead is included. Raw config, seed, hardware/browser/display, JS hash, git status and entity history are in [native session](profiling-results/native-gpu/session.json) and [standard combat session](profiling-results/native-gpu-combat/session.json). No frame-rate results are extrapolated to unmeasured workloads.

### Five-cycle memory/resource investigation

| Cycle | Post-GC heap bytes | DOM listeners | Game / canvas / Pixi objects / textures | Audio contexts / active voices / buffers |
| --- | --- | --- | --- | --- |
| 1 | 8118772 | 200 | 0 / 0 / 0 / 0 | 1 / 0 / 17 |
| 2 | 8527088 | 200 | 0 / 0 / 0 / 0 | 1 / 0 / 17 |
| 3 | 8842776 | 200 | 0 / 0 / 0 / 0 | 1 / 0 / 17 |
| 4 | 9006032 | 200 | 0 / 0 / 0 / 0 | 1 / 0 / 17 |
| 5 | 9152188 | 200 | 0 / 0 / 0 / 0 | 1 / 0 / 17 |

Native first-to-fifth post-GC delta: **1033416 bytes**; after five extra idle seconds and another GC: **9152368 bytes**. Historical delta: 977500 bytes. Full evidence: [native cycles](profiling-results/native-gpu/cycles.json). Short UI navigation sounds are allowed to finish before post-exit measurement; this respects their existing behavior rather than muting them artificially.

All explicit game/canvas/Pixi/owned-texture counters and destroyed flags are checked after every exit; game state is cleared. One shared AudioContext and 17 decoded buffers are intentional now (historical build had 12). This supports correct teardown of the measured resources. It does **not** prove that every object is unretained: aggregate heap growth, including the old monotonic trend, remains inconclusive without allocation/retainer snapshots. No specific leaked resource was identified. MSW worker heap, GPU VRAM and process memory are not measured. Five-cycle warm-up and browser/React caches can affect heap values; do not label the increase harmless or a confirmed leak solely from totals.

### Reproducible commands (PowerShell)

```powershell
node profiling/probe-gpu.mjs
npm run build:profile
$env:PROFILE_CHANNEL = 'chromium'
$env:PROFILE_REQUIRE_GPU = '1'
$env:PROFILE_EVIDENCE_DIR = 'profiling-results/native-gpu'
Remove-Item Env:PROFILE_SPAWN_SECONDS -ErrorAction SilentlyContinue
Remove-Item Env:PROFILE_ALLOW_EARLY_EXIT -ErrorAction SilentlyContinue
npm run profile
$env:PROFILE_EVIDENCE_DIR = 'profiling-results/native-gpu-combat'
$env:PROFILE_SPAWN_SECONDS = '3'
$env:PROFILE_ALLOW_EARLY_EXIT = '1'
npm run profile -- --grep 'real production combat'
$env:PROFILE_EVIDENCE_DIR = 'profiling-results/native-gpu-dense'
$env:PROFILE_SPAWN_SECONDS = '1'
npm run profile -- --grep 'real production combat'
node profiling/compare.mjs
npm run typecheck
npm run lint
npm run build
```

PROFILE_ALLOW_EARLY_EXIT permits collecting an honest combat attempt ending in death; exit 0 does not imply 180-second compliance. Compare actual active/wall durations and finishReason. Custom evidence directories preserve the historical report; compare.mjs regenerates only this review section from measured JSONs. Normal production build remains free of profiling hooks. No gameplay code or Master Checklist was changed.

### Manual visible Chrome / retainer follow-up

1. Build with npm run build:profile; serve with npm run preview -- --host 127.0.0.1 --port 4173 --strictPort. Open this URL in regular Chrome, hardware acceleration enabled. In chrome://gpu confirm WebGL/compositing hardware acceleration and AMD D3D11 GL_RENDERER; do not override safety blocklists to force a claim.
2. Use Options: 180 seconds, spawn 3 seconds. In DevTools Console run window.pirateProfile.resources() and, after Start Game, window.pirateProfile.report(). Keep focus on gameplay and close/undock DevTools during the measured session; switching tabs intentionally pauses the game. Fight using actual controls for 180 active seconds, or explicitly record early death.
3. After completion export with copy(JSON.stringify(window.pirateProfile.report())). This contains actual intervals/entity samples. A manual session is a separate environment: record Chrome version, chrome://gpu output, resolution/DPR, build hash and date. Do not combine samples across matches.
4. For retained-memory analysis, warm up once, exit, wait for UI audio to finish, take a Memory heap snapshot with GC. Repeat five actual Start Game / play / Quit Match cycles, take another snapshot after idle, then compare retained size and retaining paths for Game, InputManager, Application, textures, DOM nodes and closures. Save snapshots separately; broad totals alone are insufficient. DevTools changes overhead, so memory analysis and FPS recording should be separate runs.

### Validation and remaining limits

Executed checks: node profiling/probe-gpu.mjs: exit 0; npm run build:profile: exit 0; PROFILE_CHANNEL=chromium PROFILE_REQUIRE_GPU=1 PROFILE_EVIDENCE_DIR=profiling-results/native-gpu npm run profile: exit 0, 2 passed (6.1 minutes); PROFILE_CHANNEL=chromium PROFILE_REQUIRE_GPU=1 PROFILE_EVIDENCE_DIR=profiling-results/native-gpu-combat PROFILE_SPAWN_SECONDS=3 PROFILE_ALLOW_EARLY_EXIT=1 npm run profile -- --grep 'real production combat': exit 0, 1 passed (2.2 minutes); PROFILE_CHANNEL=chromium PROFILE_REQUIRE_GPU=1 PROFILE_EVIDENCE_DIR=profiling-results/native-gpu-dense PROFILE_SPAWN_SECONDS=1 PROFILE_ALLOW_EARLY_EXIT=1 npm run profile -- --grep 'real production combat': exit 0, 1 passed (35.1 seconds); npm run typecheck: exit 0; npm run lint: exit 0; npm run build: exit 0; npx tsc --noEmit --skipLibCheck --strict --target ES2022 --module ESNext --moduleResolution Bundler --types node profiling/production.spec.ts playwright.profile.config.ts: exit 0; node --check profiling/compare.mjs; node --check profiling/run.mjs; node --check profiling/probe-gpu.mjs: exit 0. The separate strict harness typecheck initially detected two optional CDP featureStatus accesses; optional chaining fixed both, then it passed. Syntax checks also passed. Normal production output was inspected and contains neither pirateProfile nor profileSession. Full regression suite was not rerun in this task. See [validation evidence](profiling-results/native-validation.json) and environment-specific validation.json. No complete regression-suite claim is inferred from the historical 160-test run. Existing chunk-size and NO_COLOR/FORCE_COLOR warnings remain separate from measured runtime performance. Repeating native benchmarks and physical-phone testing remain recommended; no speculative optimization was performed.
