import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MarketDataProvider } from './core/market-data.provider';
import { MarketstackProvider } from './marketstack/marketstack.provider';
import { MockMarketProvider } from './mock/mock-market.provider';
import { KisMarketProvider } from './kis/kis.provider';

@Injectable()
export class ProviderRegistry {
  constructor(
    private readonly config: ConfigService,
    private readonly marketstack: MarketstackProvider,
    private readonly kis: KisMarketProvider,
    private readonly mock: MockMarketProvider,
  ) {}
  marketData(): MarketDataProvider {
    const code = (this.config.get<string>('MARKET_DATA_PROVIDER') ?? 'mock').toUpperCase();
    if (code === 'MARKETSTACK') return this.marketstack;
    if (code === 'KIS' || code === 'KOREA_INVESTMENT') return this.kis;
    if (code === 'MOCK') return this.mock;
    throw new Error(`Unsupported MARKET_DATA_PROVIDER=${code}`);
  }
}
