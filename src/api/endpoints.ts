import type {
  PaginatedResponse,
  PaginationParams,
} from '@/types/domain';
import { httpClient } from './client';
import type { MatchHistoryRecord, SubmitMatchRequest } from './matchContracts';
import { LOCAL_PLAYER } from '@/config/localPlayer';
import type { RankingEntry, RankingParams } from './rankingContracts';
import { isHistoryRecord, isRankingEntry, readPaginatedResponse } from './responseValidation';
import { isSameMatch } from './matchContracts';

export type { SubmitMatchRequest } from './matchContracts';

export async function getRanking(
  params: RankingParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<RankingEntry>> {
  const { data } = await httpClient.get<unknown>(
    '/ranking',
    { params, signal },
  );
  return readPaginatedResponse(data, isRankingEntry);
}

export async function getHistory(
  params: PaginationParams = { page: 1, pageSize: 20 },
  signal?: AbortSignal,
): Promise<PaginatedResponse<MatchHistoryRecord>> {
  const { data } = await httpClient.get<unknown>(
    '/history',
    { params: { ...params, playerId: LOCAL_PLAYER.id }, signal },
  );
  return readPaginatedResponse(data, isHistoryRecord);
}

export async function submitMatch(
  payload: SubmitMatchRequest,
): Promise<MatchHistoryRecord> {
  const { data } = await httpClient.post<unknown>('/matches', payload);
  if (!isHistoryRecord(data) || !isSameMatch(payload, data)) {
    throw new Error('The API did not confirm the submitted match data.');
  }
  return data;
}
