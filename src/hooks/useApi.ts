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
    queryFn: () => getRanking(params),
    refetchOnMount: 'always',
  });
}

export function useHistory(
  params: PaginationParams = { page: 1, pageSize: 20 },
) {
  return useQuery({
    queryKey: queryKeys.history(params),
    queryFn: () => getHistory(params),
    refetchOnMount: 'always',
  });
}

export function useSubmitMatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SubmitMatchRequest) => submitMatch(payload),
    retry: false,
    onMutate: (payload) => {
      queryClient.setQueryData<MatchRegistration>(queryKeys.registration(payload.matchId), { status: 'submitting' });
    },
    onSuccess: (record) => {
      queryClient.setQueryData<MatchRegistration>(queryKeys.registration(record.matchId), () => ({ status: 'submitted', record }));
      void queryClient.invalidateQueries({ queryKey: ["ranking"] });
      void queryClient.invalidateQueries({ queryKey: ["history"] });
    },
    onError: (_error, payload) => {
      queryClient.setQueryData<MatchRegistration>(queryKeys.registration(payload.matchId), { status: 'failed' });
    },
  });
}

export function useMatchRegistration(matchId?: string) {
  return useQuery<MatchRegistration>({
    queryKey: queryKeys.registration(matchId),
    queryFn: skipToken,
    enabled: false,
    initialData: { status: 'not_submitted' },
  });
}
