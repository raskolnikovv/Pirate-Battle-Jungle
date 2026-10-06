import type {
  PaginatedResponse,
  PaginationParams,
} from '@/types/domain';
import { httpClient } from './client';
import type { MatchHistoryRecord, SubmitMatchRequest } from './matchContracts';
import { LOCAL_PLAYER } from '@/config/localPlayer';
import type { RankingEntry, RankingParams } from './rankingContracts';

export type { SubmitMatchRequest } from './matchContracts';

export async function getRanking(
  params: RankingParams,
): Promise<PaginatedResponse<RankingEntry>> {
  const { data } = await httpClient.get<PaginatedResponse<RankingEntry>>(
    '/ranking',
    { params },
  );
  return data;
}

export async function getHistory(
  params: PaginationParams = { page: 1, pageSize: 20 },
): Promise<PaginatedResponse<MatchHistoryRecord>> {
  const { data } = await httpClient.get<PaginatedResponse<MatchHistoryRecord>>(
    '/history',
    { params: { ...params, playerId: LOCAL_PLAYER.id } },
  );
  return data;
}

export async function submitMatch(
  payload: SubmitMatchRequest,
): Promise<MatchHistoryRecord> {
  const { data } = await httpClient.post<MatchHistoryRecord>('/matches', payload);
  return data;
}
