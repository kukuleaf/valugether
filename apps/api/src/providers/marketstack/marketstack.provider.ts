import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FetchEodOptions, MarketDataProvider } from '../core/market-data.provider';
import { NormalizedDailyPrice } from '../core/normalized-models';
import { MarketstackEodItem, MarketstackPage } from './marketstack.external';
import { toNormalizedPrice } from './marketstack.mapper';

@Injectable()
export class MarketstackProvider implements MarketDataProvider {
  readonly code = 'MARKETSTACK';
  constructor(private readonly config: ConfigService) {}

  async fetchLatestEod({ exchangeMic }: FetchEodOptions): Promise<NormalizedDailyPrice[]> {
    const key = this.config.get<string>('MARKET_DATA_API_KEY');
    if (!key) throw new Error('MARKET_DATA_API_KEY is not configured');
    const base = this.config.get('MARKET_DATA_BASE_URL') ?? 'https://api.marketstack.com/v1';
    const limit = 1000;
    let offset = 0;
    const result: NormalizedDailyPrice[] = [];

    while (true) {
      // Marketstack exchange endpoint accepts MIC/exchange identifiers such as XNAS/XNYS.
      const url = new URL(`${base}/exchanges/${encodeURIComponent(exchangeMic)}/eod/latest`);
      url.searchParams.set('access_key', key);
      url.searchParams.set('limit', String(limit));
      url.searchParams.set('offset', String(offset));
      const response = await fetch(url, { headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(`Marketstack HTTP ${response.status}`);
      const page = (await response.json()) as MarketstackPage<MarketstackEodItem>;
      for (const item of page.data ?? []) {
        const normalized = toNormalizedPrice(item, exchangeMic);
        if (normalized) result.push(normalized);
      }
      const p = page.pagination;
      if (!p || p.offset + p.count >= p.total || p.count === 0) break;
      offset += p.count;
    }
    return result;
  }
}
