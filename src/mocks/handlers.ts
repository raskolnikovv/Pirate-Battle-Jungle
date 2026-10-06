import { http, HttpResponse } from 'msw';
import type { PaginatedResponse } from '@/types/domain';
import type { MatchHistoryRecord } from '@/api/matchContracts';
import { getMockHistory, getMockRanking, registerMockMatch } from './matchHistoryState';
import { isHistoryRecord } from '@/api/responseValidation';
import { LOCAL_PLAYER } from '@/config/localPlayer';
import { beginNetworkRequest, networkFailure, delayAfterConfirmation } from './networkScenarios';
import { createScenarioFixtures } from './scenarioFixtures';

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

  http.get('/api/ranking', async ({ request }) => {
    const scenario = beginNetworkRequest('ranking');
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Number(url.searchParams.get('pageSize') ?? '20');
    const configKey = url.searchParams.get('configKey');
    if (!configKey) return HttpResponse.json({ message: 'Configuration key is required.' }, { status: 400 });
    const data = paginate(scenario.scenario === 'empty' ? [] : getMockRanking(configKey,
      scenario.scenario === 'multiple_pages' ? createScenarioFixtures(configKey) : []), page, pageSize);
    const failure = await networkFailure(scenario);
    return failure ?? HttpResponse.json(data);
  }),

  http.get('/api/history', async ({ request }) => {
    const scenario = beginNetworkRequest('history');
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Number(url.searchParams.get('pageSize') ?? '20');
    const data = paginate<MatchHistoryRecord>(scenario.scenario === 'empty' ? [] : getMockHistory(
      url.searchParams.get('playerId') ?? LOCAL_PLAYER.id,
      scenario.scenario === 'multiple_pages' ? createScenarioFixtures() : []), page, pageSize);
    const failure = await networkFailure(scenario);
    return failure ?? HttpResponse.json(data);
  }),

  http.post('/api/matches', async ({ request }) => {
    const scenario = beginNetworkRequest('matches');
    const failure = await networkFailure(scenario);
    if (failure) return failure;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return HttpResponse.json({ message: 'Invalid JSON.' }, { status: 400 });
    }
    if (!isHistoryRecord(body)) return HttpResponse.json({ message: 'Invalid completed match.' }, { status: 400 });
    const result = registerMockMatch(body);
    if (result.status === 'conflict') return HttpResponse.json({ message: 'Match ID already exists with different data.' }, { status: 409 });
    if (result.status === 'storage_unavailable') return HttpResponse.json({ message: 'Unable to persist confirmed match.' }, { status: 503 });
    await delayAfterConfirmation(scenario);
    return HttpResponse.json(result.record, { status: result.status === 'created' ? 201 : 200 });
  }),
];
