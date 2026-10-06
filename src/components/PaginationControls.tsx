import type { PaginationParams } from '@/types/domain';

interface PaginationControlsProps extends PaginationParams {
  total: number;
  totalPages: number;
  busy: boolean;
  onPageChange: (page: number) => void;
}

export function PaginationControls({ page, pageSize, total, totalPages, busy, onPageChange }: PaginationControlsProps) {
  return (
    <nav aria-label="Results pagination" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'center', marginTop: 16 }}>
      <button type="button" className="pause-action" disabled={busy || page <= 1} onClick={() => onPageChange(page - 1)}>Previous</button>
      <p role="status">{total === 0 ? '0 results' : `Page ${page} of ${totalPages} · ${total} results`} · {pageSize} per page</p>
      <button type="button" className="pause-action" disabled={busy || page >= totalPages} onClick={() => onPageChange(page + 1)}>Next</button>
    </nav>
  );
}
