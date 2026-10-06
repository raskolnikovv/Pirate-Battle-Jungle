import type { PaginationParams } from '@/types/domain';
import type { MatchHistoryRecord } from './matchContracts';

export interface RankingParams extends PaginationParams {
  configKey: string;
}

export interface RankingEntry extends MatchHistoryRecord {
  readonly rank: number;
}
