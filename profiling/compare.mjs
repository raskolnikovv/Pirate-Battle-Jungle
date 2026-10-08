import { readFileSync, writeFileSync } from 'node:fs';
const read = path => JSON.parse(readFileSync(`profiling-results/${path}.json`, 'utf8'));
const old = read('session');
const native = read('native-gpu/session');
const dense = read('native-gpu-combat/session');
const stress = read('native-gpu-dense/session');
const cycles = read('native-gpu/cycles');
const windowsGpu = read('windows-gpu');
const validation = read('native-validation');
const num = n => typeof n === 'number' ? n.toFixed(2) : 'not measured';
const complete = run => run.final.finishReason === 'time_expired' && run.final.elapsedSeconds === 180 && run.measuredWallSeconds >= 180;
const row = (name, run) => `| ${name} | ${run.environment.spawnSeconds} | ${num(run.measuredWallSeconds)} / ${num(run.final.elapsedSeconds)} | ${run.final.finishReason} | ${num(run.statistics.averageFps)} | ${num(run.statistics.p95FrameMs)} | ${run.statistics.frameSamples} | ${run.maximumEnemies} / ${run.maximumProjectiles} / ${run.maximumTotalEntities} |`;
const heaps = cycles.cycles.map(c => c.after.jsHeapUsedBytes);
const summary = {
  date: new Date().toISOString(),
  nativeComplete180Seconds: complete(native), combatComplete180Seconds: complete(dense), stressComplete180Seconds: complete(stress),
  nativeCanvasRenderer: native.environment.canvasRenderer, combatCanvasRenderer: dense.environment.canvasRenderer,
  previousHeapDeltaBytes: 977500, nativeHeapDeltaBytes: heaps.at(-1) - heaps[0],
  nativeIdleHeapBytes: cycles.idleAfter.jsHeapUsedBytes,
  nativeFrameStatistics: native.statistics, combatFrameStatistics: dense.statistics, stressFrameStatistics: stress.statistics,
};
writeFileSync('profiling-results/native-comparison.json', JSON.stringify(summary, null, 2));
const section = `
## Native GPU verification and workload review (2026-10-08)


The earlier sections above are historical software-rendering measurements and checks, not results for the current build. Original session/cycle JSONs remain unchanged. New measurements use optimized production preview with full Chromium via PROFILE_CHANNEL=chromium, headless desktop, 1280x900, DPR 1. They are neither physical-mobile measurements nor visible-window Chrome measurements.

### Verified backend and cause of SwiftShader

GPU probe: [raw devices, feature status and launch arguments](profiling-results/gpu-probe.json). Default Playwright launches chrome-headless-shell.exe; its observed command line includes --use-angle=swiftshader-webgl. Full Chromium headless, both automatic backend selection and explicit D3D11, identified AMD Radeon Graphics via Direct3D11 with WebGL/compositing enabled. The Windows adapter reports driver ${windowsGpu.DriverVersion}, ${windowsGpu.CurrentHorizontalResolution}x${windowsGpu.CurrentVerticalResolution} at ${windowsGpu.CurrentRefreshRate} Hz; the browser viewport remains 1280x900. See windows-gpu.json. Merely allowing --enable-unsafe-swiftshader is not proof of software rendering: that fallback permission also appears in the hardware run. Actual canvas UNMASKED_RENDERER_WEBGL and CDP SystemInfo are the verification criteria.

Native gameplay canvas: **${native.environment.canvasRenderer}**. Combat canvas: **${dense.environment.canvasRenderer}**. Both runs require recognized hardware plus enabled WebGL/compositing before measurement. GPU-process crash counts and driver metadata are recorded in each JSON. This establishes successful native acceleration in these runs; it does not guarantee every machine/session behaves identically.

### Measurements and representativeness

| Environment / workload | Spawn s | Wall / active s | Ending | Mean FPS | p95 ms | Intervals | Max enemies / projectiles / total entities |
| --- | --- | --- | --- | --- | --- | --- | --- |
${row('Historical SwiftShader, light', old)}
${row('Native AMD D3D11, light', native)}
${row('Native AMD D3D11, standard combat', dense)}
${row('Native AMD D3D11, dense combat', stress)}

Native light run completes 180 seconds: **${complete(native) ? 'YES' : 'NO'}**. Standard combat completes 180 seconds: **${complete(dense) ? 'YES' : 'NO; early death is an incomplete three-minute measurement'}**. Low 1% interval-derived FPS: native light ${num(native.statistics.low1PercentFps)}, combat ${num(dense.statistics.low1PercentFps)}. Single longest-interval FPS: ${num(native.statistics.minimumIntervalFps)} / ${num(dense.statistics.minimumIntervalFps)}. Runtime errors: ${JSON.stringify(native.errors)} / ${JSON.stringify(dense.errors)}. Finals: light HP ${native.final.player.health}, score ${native.final.score}; combat HP ${dense.final.player.health}, score ${dense.final.score}.

Previous maximum of one enemy was not a concurrency cap. SpawnSystem creates one enemy per interval, with no one-enemy limit. Previous interval was 15 seconds, and the aiming pilot held all weapons. Only 19 of 177 one-second samples had live enemies; they were removed before the next interval. The final had 11 defeated enemies and one survivor. This is a survival/light-load benchmark, not standard dense combat. The new standard run uses the same pilot and normal 3-second Options interval. It still peaked at one enemy because the pilot eliminated targets rapidly. A third native run uses the valid 1-second Options minimum and peaks at ${stress.maximumEnemies} enemies / ${stress.maximumProjectiles} projectiles / ${stress.maximumTotalEntities} entities, ending after ${num(stress.final.elapsedSeconds)} active seconds (${stress.final.finishReason}); this is ${complete(stress) ? 'a complete three-minute dense run' : 'a short dense-combat observation, NOT a complete three-minute dense benchmark'}. Its low 1% interval-derived FPS is ${num(stress.statistics.low1PercentFps)}, minimum interval-derived FPS ${num(stress.statistics.minimumIntervalFps)}, final score ${stress.final.score}, runtime errors ${JSON.stringify(stress.errors)}. See [dense session](profiling-results/native-gpu-dense/session.json), including actual renderer verification. Damage, spawning, movement, collision, cooldown and clock rules are unchanged; early death is recorded, not repaired by changing HP.

These are workload/environment comparisons rather than an isolated GPU A/B experiment: the previous JS build differs (subsequent UI audio/background changes), and real input scheduling changes outcomes. Render cadence is measured after actual renders, not the fixed 60 Hz simulation or monitor presentation. The observed approximately 100 FPS cadence is compatible with the Windows-reported 100 Hz display; headless presentation behavior still differs from a visible window. Playwright records a trace during the run (retained only on failure), so instrumentation overhead is included. Raw config, seed, hardware/browser/display, JS hash, git status and entity history are in [native session](profiling-results/native-gpu/session.json) and [standard combat session](profiling-results/native-gpu-combat/session.json). No frame-rate results are extrapolated to unmeasured workloads.

### Five-cycle memory/resource investigation

| Cycle | Post-GC heap bytes | DOM listeners | Game / canvas / Pixi objects / textures | Audio contexts / active voices / buffers |
| --- | --- | --- | --- | --- |
${cycles.cycles.map(c => { const a=c.after, r=a.resources; return `| ${c.cycle} | ${a.jsHeapUsedBytes} | ${a.jsEventListeners} | ${r.activeGames} / ${r.canvasCount} / ${r.pixiDisplayObjects} / ${r.ownedGameplayTextures} | ${r.audioContexts} / ${r.audioVoices} / ${r.audioBuffers} |`; }).join('\n')}

Native first-to-fifth post-GC delta: **${summary.nativeHeapDeltaBytes} bytes**; after five extra idle seconds and another GC: **${summary.nativeIdleHeapBytes} bytes**. Historical delta: 977500 bytes. Full evidence: [native cycles](profiling-results/native-gpu/cycles.json). Short UI navigation sounds are allowed to finish before post-exit measurement; this respects their existing behavior rather than muting them artificially.

All explicit game/canvas/Pixi/owned-texture counters and destroyed flags are checked after every exit; game state is cleared. One shared AudioContext and 17 decoded buffers are intentional now (historical build had 12). This supports correct teardown of the measured resources. It does **not** prove that every object is unretained: aggregate heap growth, including the old monotonic trend, remains inconclusive without allocation/retainer snapshots. No specific leaked resource was identified. MSW worker heap, GPU VRAM and process memory are not measured. Five-cycle warm-up and browser/React caches can affect heap values; do not label the increase harmless or a confirmed leak solely from totals.

### Reproducible commands (PowerShell)

\`\`\`powershell
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
\`\`\`

PROFILE_ALLOW_EARLY_EXIT permits collecting an honest combat attempt ending in death; exit 0 does not imply 180-second compliance. Compare actual active/wall durations and finishReason. Custom evidence directories preserve the historical report; compare.mjs regenerates only this review section from measured JSONs. Normal production build remains free of profiling hooks. No gameplay code or Master Checklist was changed.

### Manual visible Chrome / retainer follow-up

1. Build with npm run build:profile; serve with npm run preview -- --host 127.0.0.1 --port 4173 --strictPort. Open this URL in regular Chrome, hardware acceleration enabled. In chrome://gpu confirm WebGL/compositing hardware acceleration and AMD D3D11 GL_RENDERER; do not override safety blocklists to force a claim.
2. Use Options: 180 seconds, spawn 3 seconds. In DevTools Console run window.pirateProfile.resources() and, after Start Game, window.pirateProfile.report(). Keep focus on gameplay and close/undock DevTools during the measured session; switching tabs intentionally pauses the game. Fight using actual controls for 180 active seconds, or explicitly record early death.
3. After completion export with copy(JSON.stringify(window.pirateProfile.report())). This contains actual intervals/entity samples. A manual session is a separate environment: record Chrome version, chrome://gpu output, resolution/DPR, build hash and date. Do not combine samples across matches.
4. For retained-memory analysis, warm up once, exit, wait for UI audio to finish, take a Memory heap snapshot with GC. Repeat five actual Start Game / play / Quit Match cycles, take another snapshot after idle, then compare retained size and retaining paths for Game, InputManager, Application, textures, DOM nodes and closures. Save snapshots separately; broad totals alone are insufficient. DevTools changes overhead, so memory analysis and FPS recording should be separate runs.

### Validation and remaining limits

Executed checks: ${validation.commands.map(c => c.command + ': exit ' + c.exitCode + (c.passed ? ', ' + c.passed + ' passed (' + c.durationReported + ')' : '')).join('; ')}. The separate strict harness typecheck initially detected two optional CDP featureStatus accesses; optional chaining fixed both, then it passed. Syntax checks also passed. Normal production output was inspected and contains neither pirateProfile nor profileSession. Full regression suite was not rerun in this task. See [validation evidence](profiling-results/native-validation.json) and environment-specific validation.json. No complete regression-suite claim is inferred from the historical 160-test run. Existing chunk-size and NO_COLOR/FORCE_COLOR warnings remain separate from measured runtime performance. Repeating native benchmarks and physical-phone testing remain recommended; no speculative optimization was performed.
`;
const path='PERFORMANCE_REPORT.md';
let prior=readFileSync(path,'utf8').split('\n## Native GPU verification and workload review')[0];
if (!prior.includes('Historical baseline:')) prior = prior.replace('# Pirate Battle production performance report', '# Pirate Battle production performance report\n\n> Historical baseline: the original sections describe SwiftShader. See the Native GPU verification section below for new hardware measurements and their limitations.');
writeFileSync(path,prior+section);
