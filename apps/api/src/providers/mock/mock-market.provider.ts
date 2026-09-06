import { Injectable } from '@nestjs/common';
import { FetchEodOptions, MarketDataProvider } from '../core/market-data.provider';
import { NormalizedDailyPrice } from '../core/normalized-models';
@Injectable()
export class MockMarketProvider implements MarketDataProvider {
  readonly code = 'MOCK';
  async fetchLatestEod({ exchangeMic }: FetchEodOptions): Promise<NormalizedDailyPrice[]> {
    const today = new Date().toISOString().slice(0, 10);
    return [
      {
        providerCode: 'MOCK',
        externalSymbol: 'DEMOA',
        exchangeMic,
        tradeDate: today,
        open: 100,
        high: 104,
        low: 99,
        close: 103,
        adjustedClose: 103,
        volume: 100000,
        currency: 'USD',
      },
      {
        providerCode: 'MOCK',
        externalSymbol: 'DEMOB',
        exchangeMic,
        tradeDate: today,
        open: 50,
        high: 51,
        low: 48,
        close: 49,
        adjustedClose: 49,
        volume: 200000,
        currency: 'USD',
      },
    ];
  }
}
