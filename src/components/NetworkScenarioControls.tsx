import { useState, useSyncExternalStore } from 'react';
import { useIsMutating, useQueryClient } from '@tanstack/react-query';
import { NETWORK_SCENARIOS, getNetworkSelection, selectNetworkScenario, subscribeNetworkSelection,
  type NetworkScenario, type ScenarioTarget } from '@/mocks/networkScenarios';
import { resetConfirmedMockMatches } from '@/mocks/matchHistoryState';
import { resetPendingMatches } from '@/storage/pendingMatchesStorage';

export function NetworkScenarioControls() {
  const selection = useSyncExternalStore(subscribeNetworkSelection, getNetworkSelection);
  const queryClient = useQueryClient();
  const submitting = useIsMutating({ mutationKey: ['matches'] }) > 0;
  const [message, setMessage] = useState('');
  const [resetting, setResetting] = useState(false);
  async function select(scenario: NetworkScenario, target: ScenarioTarget) {
    await Promise.all([
      queryClient.cancelQueries({ queryKey: ['ranking'] }),
      queryClient.cancelQueries({ queryKey: ['history'] }),
    ]);
    const saved = selectNetworkScenario({ scenario, target });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['ranking'] }),
      queryClient.invalidateQueries({ queryKey: ['history'] }),
    ]);
    setMessage(saved ? 'Scenario saved. Request sequences restarted.' : 'Scenario active for this session; unable to save selection.');
  }
  async function reset() {
    setResetting(true);
    // No in-flight submissions may repopulate the reset server or queue.
    const confirmed = resetConfirmedMockMatches();
    const pending = resetPendingMatches();
    queryClient.removeQueries({ queryKey: ['match-registration'] });
    await select('success', 'all');
    setMessage(confirmed && pending ? 'Reset complete: initial fixtures restored; confirmed and pending matches cleared.'
      : 'Reset incomplete: storage could not be cleared. Check pending storage warnings.');
    setResetting(false);
  }
  return <details style={{ width: '100%', marginTop: 20, padding: 12, border: '1px dashed #94a3b8', borderRadius: 8 }}>
    <summary>Development / demo network scenarios</summary>
    <p>Active: {NETWORK_SCENARIOS[selection.scenario]} · Target: {selection.target}</p>
    <label htmlFor="network-scenario">Network scenario</label>{' '}
    <select id="network-scenario" value={selection.scenario} disabled={submitting || resetting}
      onChange={(event) => { void select(event.target.value as NetworkScenario, selection.target); }}>
      {Object.entries(NETWORK_SCENARIOS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
    <p><label htmlFor="network-target">Target endpoint</label>{' '}
      <select id="network-target" value={selection.target} disabled={submitting || resetting}
        onChange={(event) => { void select(selection.scenario, event.target.value as ScenarioTarget); }}>
        <option value="all">All endpoints</option><option value="ranking">Ranking</option>
        <option value="history">Match History</option><option value="matches">Match submission</option>
      </select></p>
    <p>Selection survives refresh; delay counters restart. Slow: 1.5s. Timeouts: 10s client / 11s server.</p>
    <p>Reset deletes confirmed and pending matches. Options and the last local result are preserved.</p>
    <button className="pause-action" disabled={submitting || resetting} onClick={() => { void reset(); }}>Reset network demo</button>
    {submitting && <p>Wait for the active submission before changing or resetting the scenario.</p>}
    {message && <p role="status">{message}</p>}
  </details>;
}
