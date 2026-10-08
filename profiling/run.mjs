import { existsSync, mkdirSync, cpSync, unlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const evidence = process.env.PROFILE_EVIDENCE_DIR ?? 'profiling-results';
const archive = `${evidence}/attempts/${new Date().toISOString().replace(/[:.]/g, '-')}`;
mkdirSync(archive, { recursive: true });
for (const name of ['session.json', 'cycles.json', 'traces', 'html']) {
  if (existsSync(`${evidence}/${name}`)) cpSync(`${evidence}/${name}`, `${archive}/${name}`, { recursive: true });
}
// Remove only prior raw summaries after archiving so failed setup cannot reuse stale measurements.
for (const name of ['session.json', 'cycles.json']) {
  if (existsSync(`${evidence}/${name}`)) unlinkSync(`${evidence}/${name}`);
}
const startedAt = new Date().toISOString();
const result = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--config', 'playwright.profile.config.ts', ...process.argv.slice(2)], { stdio: 'inherit' });
writeFileSync(`${evidence}/validation.json`, JSON.stringify({ startedAt, endedAt: new Date().toISOString(), exitCode: result.status, command: 'npm run profile', arguments: process.argv.slice(2), environment: { channel: process.env.PROFILE_CHANNEL ?? null, requireGpu: process.env.PROFILE_REQUIRE_GPU === '1', spawnSeconds: process.env.PROFILE_SPAWN_SECONDS ?? '15', allowEarlyExit: process.env.PROFILE_ALLOW_EARLY_EXIT === '1', evidence } }, null, 2));
if (evidence === 'profiling-results') await import('./report.mjs');
process.exitCode = result.status ?? 1;
