import { http, HttpResponse } from 'msw';
import type { MatchHistoryEntry, MatchResult, PaginatedResponse, RankingEntry } from '@/types/domain';
import { HISTORY_FIXTURE, RANKING_FIXTURE } from './fixtures';

function paginate<T>(
  items: T[],
  page: number,
  pageSize: number,
): PaginatedResponse<T> {
  const safePage = Math.max(1, page);
  const safeSize = Math.max(1, pageSize);
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
  http.get('/api/ranking', ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Number(url.searchParams.get('pageSize') ?? '20');
    return HttpResponse.json(paginate<RankingEntry>(RANKING_FIXTURE, page, pageSize));
  }),

  http.get('/api/history', ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Number(url.searchParams.get('pageSize') ?? '20');
    return HttpResponse.json(
      paginate<MatchHistoryEntry>(HISTORY_FIXTURE, page, pageSize),
    );
  }),

  http.post('/api/matches', async ({ request }) => {
    const body = (await request.json()) as {
      playerName: string;
      score: number;
      enemiesDefeated: number;
      endReason: MatchResult['survived'];
      durationSeconds: number;
    };

    const matchId = `match-${Date.now()}`;
    const result: MatchResult = {
      matchId,
      playerScore: body.score,
      enemiesDefeated: body.enemiesDefeated,
      survived: body.endReason,
      durationSeconds: body.durationSeconds,
      playerName: body.playerName,
      completedAt: new Date().toISOString(),
    };
    return HttpResponse.json(result, { status: 201 });
  }),
];
