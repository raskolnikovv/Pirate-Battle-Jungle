import { http, HttpResponse } from 'msw';
import type { PaginatedResponse } from '@/types/domain';
import type { MatchHistoryRecord, SubmitMatchRequest } from '@/api/matchContracts';
import { getMockHistory, getMockRanking, registerMockMatch } from './matchHistoryState';
import { isCompletedMatch } from '@/storage/completedMatchStorage';
import { LOCAL_PLAYER } from '@/config/localPlayer';

function isSubmission(value: unknown): value is SubmitMatchRequest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.playerId === 'string' && record.playerId.trim().length > 0
    && typeof record.playerName === 'string' && record.playerName.trim().length > 0
    && isCompletedMatch({ ...record, elapsedSeconds: record.durationSeconds, registrationStatus: 'not_submitted' });
}

function paginate<T>(
  items: T[],
  page: number,
  pageSize: number,
): PaginatedResponse<T> {
  const safePage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
  const safeSize = Number.isFinite(pageSize) ? Math.max(1, Math.min(100, Math.floor(pageSize))) : 20;
  const total = items.length;
  const totalPages = Math.ceil(total / safeSize);
  const start = (safePage - 1) * safeSize;
  const end = start + safeSize;
  return {
    items: items.slice(start, end),
    page: safePage,
    pageSize: safeSize,
    total,
    totalPages,
  };
}

export const handlers = [
  http.get('/api/mock-status', () => HttpResponse.json({ service: 'pirate-battle-msw' })),

  http.get('/api/ranking', ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Number(url.searchParams.get('pageSize') ?? '20');
    const configKey = url.searchParams.get('configKey');
    if (!configKey) return HttpResponse.json({ message: 'Configuration key is required.' }, { status: 400 });
    return HttpResponse.json(paginate(getMockRanking(configKey), page, pageSize));
  }),

  http.get('/api/history', ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Number(url.searchParams.get('pageSize') ?? '20');
    return HttpResponse.json(
      paginate<MatchHistoryRecord>(getMockHistory(url.searchParams.get('playerId') ?? LOCAL_PLAYER.id), page, pageSize),
    );
  }),

  http.post('/api/matches', async ({ request }) => {
    try {
      const body: unknown = await request.json();
      if (!isSubmission(body)) return HttpResponse.json({ message: 'Invalid completed match.' }, { status: 400 });
      return HttpResponse.json(registerMockMatch(body), { status: 201 });
    } catch {
      return HttpResponse.json({ message: 'Invalid JSON.' }, { status: 400 });
    }
  }),
];
