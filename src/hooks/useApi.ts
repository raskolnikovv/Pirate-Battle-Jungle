import { skipToken, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getRanking,
  getHistory,
  submitMatch,
  type SubmitMatchRequest,
} from "@/api/endpoints";
import type { PaginationParams } from "@/types/domain";
import type { MatchRegistration } from "@/api/matchContracts";
import { LOCAL_PLAYER } from "@/config/localPlayer";
import type { RankingParams } from '@/api/rankingContracts';
import { isSameMatch, type MatchHistoryRecord } from '@/api/matchContracts';
import { addPendingMatch, removePendingMatch } from '@/storage/pendingMatchesStorage';
import { usePendingMatches } from './usePendingMatches';
import { isAxiosError } from 'axios';

const activeSubmissions = new Map<string, { payload: SubmitMatchRequest; promise: Promise<MatchHistoryRecord> }>();

function attemptSubmission(payload: SubmitMatchRequest): Promise<MatchHistoryRecord> {
  const active = activeSubmissions.get(payload.matchId);
  if (active) return isSameMatch(active.payload, payload) ? active.promise
    : Promise.reject(new Error('Another payload is being submitted with this match ID.'));
  const promise = (async () => {
    addPendingMatch(payload);
    return submitMatch(payload);
  })().finally(() => { activeSubmissions.delete(payload.matchId); });
  activeSubmissions.set(payload.matchId, { payload, promise });
  return promise;
}

export const queryKeys = {
  ranking: (params: RankingParams) => ["ranking", params] as const,
  history: (params?: PaginationParams) => ["history", LOCAL_PLAYER.id, params] as const,
  registration: (matchId?: string) => ["match-registration", matchId] as const,
  matches: ["matches"] as const,
};

export function useRanking(
  params: RankingParams,
) {
  return useQuery({
    queryKey: queryKeys.ranking(params),
    queryFn: ({ signal }) => getRanking(params, signal),
    refetchOnMount: 'always',
  });
}

export function useHistory(
  params: PaginationParams = { page: 1, pageSize: 20 },
) {
  return useQuery({
    queryKey: queryKeys.history(params),
    queryFn: ({ signal }) => getHistory(params, signal),
    refetchOnMount: 'always',
  });
}

export function useSubmitMatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: queryKeys.matches,
    mutationFn: attemptSubmission,
    retry: false,
    onMutate: (payload) => {
      queryClient.setQueryData<MatchRegistration>(queryKeys.registration(payload.matchId), { status: 'submitting' });
    },
    onSuccess: (record) => {
      removePendingMatch(record.matchId);
      queryClient.setQueryData<MatchRegistration>(queryKeys.registration(record.matchId), () => ({ status: 'submitted', record }));
      void queryClient.invalidateQueries({ queryKey: ["ranking"] });
      void queryClient.invalidateQueries({ queryKey: ["history"] });
    },
    onError: (error, payload) => {
      const message = isAxiosError(error) && error.response?.status === 409
        ? 'This match ID conflicts with an existing record. Your pending submission has been kept.'
        : !isAxiosError(error) && error instanceof Error ? error.message
        : 'Registration failed. Your match remains pending; you can retry.';
      queryClient.setQueryData<MatchRegistration>(queryKeys.registration(payload.matchId), () => ({ status: 'failed', message }));
    },
  });
}

export function useMatchRegistration(matchId?: string) {
  const pending = usePendingMatches();
  const query = useQuery<MatchRegistration>({
    queryKey: queryKeys.registration(matchId),
    queryFn: skipToken,
    enabled: false,
    initialData: { status: 'not_submitted' },
  });
  const data: MatchRegistration = query.data?.status === 'not_submitted'
    && pending.records.some((record) => record.matchId === matchId)
    ? { status: 'pending' } : query.data ?? { status: 'not_submitted' };
  return { ...query, data };
}
