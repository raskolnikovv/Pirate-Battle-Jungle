# Pirate Battle production performance report

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
