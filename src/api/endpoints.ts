import type {
  MatchResult,
  PaginatedResponse,
  PaginationParams,
  RankingEntry,
  MatchHistoryEntry,
} from '@/types/domain';
import { httpClient } from './client';

export interface SubmitMatchRequest {
  playerName: string;
  score: number;
  enemiesDefeated: number;
  endReason: MatchResult['survived'];
  durationSeconds: number;
}

export async function getRanking(
  params: PaginationParams = { page: 1, pageSize: 20 },
): Promise<PaginatedResponse<RankingEntry>> {
  const { data } = await httpClient.get<PaginatedResponse<RankingEntry>>(
    '/ranking',
    { params },
  );
  return data;
}

export async function getHistory(
  params: PaginationParams = { page: 1, pageSize: 20 },
): Promise<PaginatedResponse<MatchHistoryEntry>> {
  const { data } = await httpClient.get<PaginatedResponse<MatchHistoryEntry>>(
    '/history',
    { params },
  );
  return data;
}

export async function submitMatch(
  payload: SubmitMatchRequest,
): Promise<MatchResult> {
  const { data } = await httpClient.post<MatchResult>('/matches', payload);
  return data;
}
