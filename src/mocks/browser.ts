import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);

let readiness: Promise<void> | null = null;

async function checkInterception(): Promise<boolean> {
  const response = await fetch('/api/mock-status', {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return false;
  const status: unknown = await response.json();
  return typeof status === 'object' && status !== null
    && 'service' in status && status.service === 'pirate-battle-msw';
}

async function activateInterception(): Promise<void> {
  if (worker.readyState === 0) {
    // MSW selects its built-in Fetch/XHR fallback when Service Workers are absent
    // (for example on HTTP LAN). Keep the same handlers and readiness probe.
    await worker.start({ onUnhandledFrame: 'bypass' });
  }
  if (await checkInterception()) return;

  // A restarted browser worker can lose its active-client set while MSW's
  // page-side instance still reports enabled. Re-register through public APIs.
  await worker.stop();
  await worker.start({ onUnhandledFrame: 'bypass' });
  if (!await checkInterception()) throw new Error('MSW interception is unavailable.');
}

export function ensureMockWorkerReady(): Promise<void> {
  // Concurrent ranking/history/submission calls share activation, not mock data.
  readiness ??= activateInterception().finally(() => { readiness = null; });
  return readiness;
}
