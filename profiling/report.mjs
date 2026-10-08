import { existsSync, readFileSync, writeFileSync } from 'node:fs';
const read = name => existsSync(`profiling-results/${name}.json`) ? JSON.parse(readFileSync(`profiling-results/${name}.json`, 'utf8')) : null;
const session = read('session'); const cleanup = read('cycles'); const validation = read('validation'); const early = read('default-spawn-early-ending');
const checks = read('checks');
const env = session?.environment ?? cleanup?.environment;
const heaps = cleanup?.cycles.map(cycle => cycle.after.jsHeapUsedBytes).filter(value => typeof value === 'number') ?? [];
const heapDelta = heaps.length > 1 ? heaps.at(-1) - heaps[0] : null;
const number = value => typeof value === 'number' ? value.toFixed(2) : 'not available';
const complete = session?.final?.finishReason === 'time_expired' && session.final.elapsedSeconds === 180 && session.measuredWallSeconds >= 180;
const rows = cleanup?.cycles.map(cycle => {
  const after = cycle.after; const resources = after.resources;
  return `| ${cycle.cycle} | ${number(cycle.wallSeconds)} | ${after.jsHeapUsedBytes} | ${after.nodes} | ${after.jsEventListeners} | ${resources.activeGames} / ${resources.canvasCount} / ${resources.pixiDisplayObjects} / ${resources.ownedGameplayTextures} | ${resources.audioContexts} / ${resources.audioVoices} / ${resources.oceanVoices} / ${resources.audioBuffers} |`;
}).join('\n') ?? '| Not measured |';
writeFileSync('PERFORMANCE_REPORT.md', `# Pirate Battle production performance report

## Environment and reproducibility

- Measurement date: ${env?.date ?? 'not measured'}
- OS: ${env?.os ?? 'unknown'}
- CPU: ${env?.cpu ?? 'unknown'}; ${env?.logicalCpus ?? 'unknown'} logical processors
- RAM: ${env ? number(env.ramBytes / 1024 ** 3) : 'unknown'} GiB
- Chromium: ${env?.browser ?? 'unknown'}; ${env?.headless ? 'headless' : 'visible'} desktop automation
- Screen / viewport / DPR: ${JSON.stringify(env?.display ?? null)}
- Git commit: ${env?.gitCommit ?? 'unknown'} (working tree changes included; see JSON gitStatus)
- Optimized profiling build JS SHA-256: ${env?.productionJsSha256 ?? 'unknown'}
- Graphics backend: ${JSON.stringify(env?.graphics?.devices ?? null)}; full driver/feature information in JSON.
- No physical mobile measurements. Headless Chromium/GPU scheduling may differ from normal Chrome.

Commands (repository root):

\`\`\`sh
npm run typecheck
npm run lint
npm run build:profile
npm run profile
npm run build
npm test -- --workers=2
\`\`\`

The profiling command starts its own Vite preview on 127.0.0.1:4173, with no development server. Production assets and MSW status are checked. The test uses Options to set duration 180 seconds and spawn interval ${env?.spawnSeconds ?? 'unknown'} seconds. All other balance and seed values are unchanged; the full GameConfig is in session.json. An automated pilot follows a water route between enemies, aims gradually at the nearest enemy while approaching slowly, and uses the same public input intentions as touch, with all three weapons held. No HP/entity/clock mutations, accelerated time, disabled damage or invulnerability. A real 200 ms wait samples input; the game uses its own RAF and fixed simulation loop.

## Real gameplay measurement

Profiling procedure exit code: ${validation?.exitCode ?? 'not recorded'} (0 means both test assertions passed).
An earlier standard 3-second spawn attempt ended by death after ${number(early?.final?.elapsedSeconds)} active seconds (${number(early?.measuredWallSeconds)} observed wall seconds), with ${number(early?.statistics?.averageFps)} average FPS. This earlier orbit-only pilot run is incomplete and retained separately in default-spawn-early-ending.json; its pilot strategy differs from the final aiming pilot, so these attempts are not controlled benchmark comparisons. The recorded run uses the valid ${env?.spawnSeconds ?? 'unknown'}-second Options interval. ${env?.spawnSeconds === 15 ? 'This is a lighter workload and does not establish sustained performance under standard/dense spawning.' : 'Interpret performance against the actual entity counts and workload.'}

- Complete three-minute run: **${complete ? 'YES' : 'NO / NOT VERIFIED'}**
- Observed wall time: ${number(session?.measuredWallSeconds)} s
- Active simulation time: ${number(session?.final?.elapsedSeconds)} s
- Ending: ${session?.final?.finishReason ?? 'not measured'}
- Final HP / score / shots created: ${session?.final?.player?.health ?? '?'} / ${session?.final?.score ?? '?'} / ${session?.final?.shotsCreated ?? '?'}
- Average rendered FPS: **${number(session?.statistics?.averageFps)}**
- Minimum interval-derived FPS (single longest interval): ${number(session?.statistics?.minimumIntervalFps)}
- Low 1% interval-derived FPS (1000 / p99 interval): ${number(session?.statistics?.low1PercentFps)}
- p95 inter-render frame time: **${number(session?.statistics?.p95FrameMs)} ms**
- Frame intervals: ${session?.statistics?.frameSamples ?? 0}; dropped samples: ${session?.droppedSamples ?? 'unknown'}
- Maximum enemies / projectiles / all entities at render observation: ${session?.maximumEnemies ?? '?'} / ${session?.maximumProjectiles ?? '?'} / ${session?.maximumTotalEntities ?? '?'}
- Runtime errors: ${JSON.stringify(session?.errors ?? [])}

FPS is render completions divided by measured inter-render time. It is NOT the fixed 60 Hz simulation tick rate, GPU presentation time, or CPU render cost. Entity history is sampled once per second; maxima are tracked at every completed render (entities created and removed entirely between renders are not observed). Total entities includes player and static islands; effects are represented in Pixi display-object diagnostics. Raw frame intervals and timestamped entity samples are bounded and exported. The observer measures actual renders, not an extra RAF running beside the game. Configuration and spawn seed are repeatable; wall-clock scheduling and input sampling can still change exact combat outcomes between runs.

## Five-cycle cleanup

Each cycle uses the standard 3-second spawn interval and plays for approximately 10 real seconds with movement, attacks and normal spawning, exits through Quit Match, waits for canvas removal, and requests CDP garbage collection before measuring. During/after values and selected window/document listener counts are saved in cycles.json.

| Cycle | Wall s | Post-GC JS heap bytes | DOM nodes | CDP listeners | Game / canvas / Pixi objects / owned textures after exit | Audio contexts / SFX / ocean / buffers |
| --- | --- | --- | --- | --- | --- | --- |
${rows}

Post-cleanup scalar checks also verify that the referenced Pixi objects/textures were actually destroyed and Game state cleared; references are released synchronously. Post-GC heap delta from first to fifth exit: ${heapDelta ?? 'not measured'} bytes. Any monotonic trend needs longer idle/retainer analysis; stable owned-resource/listener counts alone do not rule out all retained caches or browser allocations. No leak is asserted or ruled out from these five heap numbers.

Reported Pixi objects/textures are application-owned live resources, not GPU VRAM, Pixi internal caches, or all native objects. One shared AudioContext and decoded buffer cache are intentional across screens. CDP listener and DOM totals include React/MSW/browser activity, not only game listeners. Heap variability alone is not evidence of a leak; resource teardown assertions and trends should be considered together. Measurements exclude MSW worker heap, browser process RSS and GPU memory. Forced-GC snapshots assess retained JS resources rather than natural-GC peaks.

## Regular validation (recorded separately)

${checks ? checks.commands.map(check => '- ' + check.command + ': exit ' + check.exitCode + (check.passed ? ', ' + check.passed + ' passed (' + check.durationReported + ')' : '')).join('\n') : 'Not recorded yet.'}

Recorded at: ${checks?.recordedAt ?? 'not recorded'}. Full regression HTML: playwright-report/index.html. The regular regression harness uses the development server; the separate performance procedure uses optimized production preview. Static inspection confirmed the normal production artifact contains neither pirateProfile nor profileSession. Warnings: ${checks?.warnings.join('; ') ?? 'see command output'}.

## Assessment and limitations

${env?.graphics?.devices?.some(device => device.deviceString?.includes('SwiftShader')) ? 'This recorded run used SwiftShader software rendering, as verified in environment.graphics.' : 'The recorded graphics backend is listed above; inspect environment.graphics to confirm hardware acceleration.'} Its frame rate is not native GPU performance; no GPU/device claim can be inferred from CPU model alone. Use PowerShell \`$env:PROFILE_HEADED = '1'\` then \`npm run profile\` to rerun in visible Chrome locally, keeping the window focused; inspect the newly recorded backend.

- Original three-minute requirement: ${complete ? 'measured on the documented desktop environment' : 'incomplete; see early ending or missing evidence, rerun required'}.
- Five-cycle requirement: ${cleanup?.cycles.length === 5 ? 'five cycles measured; inspect resource assertions and JSON trends' : 'incomplete'}.
- 60 FPS target: ${session?.statistics ? session.statistics.averageFps >= 59 ? 'average cadence approaches the target in this environment; inspect p95 and low-percentile stalls' : 'average cadence falls below target in this environment; investigate before claiming compliance' : 'not verified'}.
- No speculative optimizations or gameplay changes were made. Existing Vite chunk-size warning (>500 kB) concerns delivery/loading, not proof of a combat frame-rate failure.
- Profiling-only module is enabled by VITE_PROFILING=true in .env.profiling; normal npm run build removes its import path. Show FPS remains independent. Buffers are capped at 100,000 intervals and 1,000 entity samples.
- Run without other browser tests or heavy background tasks. Physical mobile and visible Chrome require separate validation; this report does not establish their performance.

## Files involved

Modified: .gitignore, package.json, README.md, DEV_NOTES_PTBR.md, src/audio/AudioManager.ts, src/components/GameCanvas.tsx, src/game/core/Game.ts, src/game/core/GameLoop.ts.
Created: .env.profiling, playwright.profile.config.ts, src/game/profiling/profileSession.ts, profiling/production.spec.ts, profiling/run.mjs, profiling/report.mjs, PERFORMANCE_REPORT.md, profiling-results/session.json, profiling-results/cycles.json, profiling-results/validation.json, profiling-results/checks.json, profiling-results/default-spawn-early-ending.json, profiling-results/orbit-early-ending.json.
Generated HTML/traces and archived attempts are ignored by Git. Existing focus styling in src/index.css was preserved; it predates this task. No gameplay balance, API contracts, Master Checklist, commits or pushes changed.

Evidence: [session JSON](profiling-results/session.json), [cycle JSON](profiling-results/cycles.json), [profiling HTML](profiling-results/html/index.html). Failed runs retain traces in profiling-results/traces. These measurements describe the hashed build, not later code changes.
`);
