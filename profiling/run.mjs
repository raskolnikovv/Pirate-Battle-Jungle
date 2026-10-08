import { existsSync, mkdirSync, cpSync, unlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const archive = `profiling-results/attempts/${new Date().toISOString().replace(/[:.]/g, '-')}`;
mkdirSync(archive, { recursive: true });
for (const name of ['session.json', 'cycles.json', 'traces', 'html']) {
  if (existsSync(`profiling-results/${name}`)) cpSync(`profiling-results/${name}`, `${archive}/${name}`, { recursive: true });
}
// Remove only prior raw summaries after archiving so failed setup cannot reuse stale measurements.
for (const name of ['session.json', 'cycles.json']) {
  if (existsSync(`profiling-results/${name}`)) unlinkSync(`profiling-results/${name}`);
}
const startedAt = new Date().toISOString();
const result = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--config', 'playwright.profile.config.ts'], { stdio: 'inherit' });
writeFileSync('profiling-results/validation.json', JSON.stringify({ startedAt, endedAt: new Date().toISOString(), exitCode: result.status, command: 'npm run profile' }, null, 2));
await import('./report.mjs');
process.exitCode = result.status ?? 1;
