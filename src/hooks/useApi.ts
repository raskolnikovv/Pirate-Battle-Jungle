import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getRanking,
  getHistory,
  submitMatch,
  type SubmitMatchRequest,
} from "@/api/endpoints";
import type { PaginationParams } from "@/types/domain";

export const queryKeys = {
  ranking: (params?: PaginationParams) => ["ranking", params] as const,
  history: (params?: PaginationParams) => ["history", params] as const,
  matches: ["matches"] as const,
};

export function useRanking(
  params: PaginationParams = { page: 1, pageSize: 20 },
) {
  return useQuery({
    queryKey: queryKeys.ranking(params),
    queryFn: () => getRanking(params),
  });
}

export function useHistory(
  params: PaginationParams = { page: 1, pageSize: 20 },
) {
  return useQuery({
    queryKey: queryKeys.history(params),
    queryFn: () => getHistory(params),
  });
}

export function useSubmitMatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SubmitMatchRequest) => submitMatch(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ranking"] });
      void queryClient.invalidateQueries({ queryKey: ["history"] });
    },
  });
}
