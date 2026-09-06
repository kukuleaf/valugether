export interface MarketstackEodItem {
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
  volume?: number | null;
  adj_open?: number | null;
  adj_high?: number | null;
  adj_low?: number | null;
  adj_close?: number | null;
  adj_volume?: number | null;
  split_factor?: number | null;
  dividend?: number | null;
  symbol: string;
  exchange?: string | null;
  date: string;
}
export interface MarketstackPage<T> {
  pagination?: { limit: number; offset: number; count: number; total: number };
  data: T[];
}
