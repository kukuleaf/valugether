import { NormalizedDailyPrice } from './normalized-models';

export interface FetchEodOptions {
  exchangeMic: string;
  date?: string;
  externalSymbols?: string[];
}

export interface MarketDataProvider {
  readonly code: string;
  fetchLatestEod(options: FetchEodOptions): Promise<NormalizedDailyPrice[]>;
  diagnostics?(): { failures: Array<{ symbol: string; error: string }> };
}
