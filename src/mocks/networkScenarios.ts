import { delay, HttpResponse } from 'msw';

export const NETWORK_SCENARIOS = {
  success: 'Success', empty: 'Empty lists', multiple_pages: 'Multiple pages',
  slow: 'Slow responses', variable_latency: 'Variable latency', out_of_order: 'Out-of-order responses',
  timeout: 'Timeout before confirmation', network_error: 'Connection error',
  http_4xx: 'HTTP 422', http_5xx: 'HTTP 500', ranking_failure: 'Ranking failure only',
  history_failure: 'History failure only', post_confirmation_timeout: 'Timeout after confirmation',
  unavailable: 'API unavailable at match end',
} as const;
export type NetworkScenario = keyof typeof NETWORK_SCENARIOS;
export type NetworkEndpoint = 'ranking' | 'history' | 'matches';
export type ScenarioTarget = 'all' | NetworkEndpoint;
interface ScenarioSelection { scenario: NetworkScenario; target: ScenarioTarget }
const storageKey = 'pirate-battle:network-scenario:v1';
const defaults: ScenarioSelection = { scenario: 'success', target: 'all' };

function loadSelection(): ScenarioSelection {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    if (value?.version === 1 && Object.prototype.hasOwnProperty.call(NETWORK_SCENARIOS, value.scenario)
      && ['all', 'ranking', 'history', 'matches'].includes(value.target)) {
      return { scenario: value.scenario, target: value.target };
    }
  } catch { /* Invalid or unavailable demo storage uses normal networking. */ }
  return defaults;
}
let selection = loadSelection();
const listeners = new Set<() => void>();
const counters: Record<NetworkEndpoint, number> = { ranking: 0, history: 0, matches: 0 };
export const getNetworkSelection = () => selection;
export function subscribeNetworkSelection(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function selectNetworkScenario(next: ScenarioSelection): boolean {
  selection = { ...next };
  counters.ranking = counters.history = counters.matches = 0;
  let saved = true;
  try { localStorage.setItem(storageKey, JSON.stringify({ version: 1, ...selection })); }
  catch { saved = false; }
  for (const listener of listeners) listener();
  return saved;
}

// Capture once per request: changing the selector never changes an in-flight outcome.
export function beginNetworkRequest(endpoint: NetworkEndpoint) {
  const index = counters[endpoint]++;
  const targeted = selection.target === 'all' || selection.target === endpoint;
  const scenario = targeted ? selection.scenario : 'success';
  const delays = [150, 700, 300, 100];
  const latency = scenario === 'slow' ? 1500
    : scenario === 'variable_latency' ? delays[index % delays.length]
    : scenario === 'out_of_order' ? (index % 2 === 0 ? 1500 : 100)
    : 0;
  return { scenario, latency, endpoint };
}
export type NetworkRequest = ReturnType<typeof beginNetworkRequest>;

export async function networkFailure(request: NetworkRequest): Promise<Response | null> {
  if (request.latency) await delay(request.latency);
  switch (request.scenario) {
    case 'timeout':
      // Longer than Axios's 10s timeout. Never continue into POST acceptance.
      await delay(11000);
      return HttpResponse.error();
    case 'network_error': return HttpResponse.error();
    case 'http_4xx': return HttpResponse.json({ message: 'Simulated client failure.' }, { status: 422 });
    case 'http_5xx': return HttpResponse.json({ message: 'Simulated server failure.' }, { status: 500 });
    case 'unavailable': return HttpResponse.json({ message: 'Simulated API outage.' }, { status: 503 });
    case 'ranking_failure':
      return request.endpoint === 'ranking' ? HttpResponse.json({ message: 'Ranking unavailable.' }, { status: 503 }) : null;
    case 'history_failure':
      return request.endpoint === 'history' ? HttpResponse.json({ message: 'History unavailable.' }, { status: 503 }) : null;
    default: return null;
  }
}

export async function delayAfterConfirmation(request: NetworkRequest): Promise<void> {
  if (request.scenario === 'post_confirmation_timeout') await delay(11000);
}
