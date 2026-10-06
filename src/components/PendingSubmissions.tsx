import { usePendingMatches } from '@/hooks/usePendingMatches';
import { useMatchRegistration, useSubmitMatch } from '@/hooks/useApi';
import type { SubmitMatchRequest } from '@/api/matchContracts';

function PendingRow({ record }: { record: SubmitMatchRequest }) {
  const submission = useSubmitMatch();
  const { data: registration } = useMatchRegistration(record.matchId);
  const busy = registration.status === 'submitting';
  return <li style={{ marginTop: 12 }}>
    <p>{record.score} points · {new Date(record.completedAt).toLocaleString('en-US')}</p>
    <p style={{ overflowWrap: 'anywhere', fontSize: 12 }}>Match: {record.matchId}</p>
    {registration.status === 'failed' && <p role="alert">{registration.message}</p>}
    {busy && <p role="status">Submitting...</p>}
    {registration.status === 'submitted' && <p>Confirmed by the API; pending storage cleanup still needs retry.</p>}
    <button type="button" className="pause-action" disabled={busy} onClick={() => submission.mutate(record)}>
      Retry registration
    </button>
  </li>;
}

export function PendingSubmissions() {
  const pending = usePendingMatches();
  if (!pending.records.length && !pending.storageError) return null;
  return <section aria-label="Pending match submissions" style={{ marginTop: 20, padding: 16, border: '1px solid #64748b', borderRadius: 8, width: '100%' }}>
    <h2 style={{ fontSize: 18 }}>Pending registrations</h2>
    <p role="status">{pending.records.length} completed {pending.records.length === 1 ? 'match' : 'matches'} awaiting registration.</p>
    {pending.storageError && <p role="alert">{pending.storageError}</p>}
    <ul style={{ listStyle: 'none' }}>{pending.records.map((record) => <PendingRow key={record.matchId} record={record} />)}</ul>
  </section>;
}
