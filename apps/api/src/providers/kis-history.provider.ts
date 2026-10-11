import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FetchEodOptions, MarketDataProvider } from './core/market-data.provider';
import { NormalizedDailyPrice } from './core/normalized-models';
import { KisDailyPriceItem, KisOverseasDailyPriceItem } from './kis/kis.external';
import { toNormalizedKisOverseasPrice, toNormalizedKisPrice } from './kis/kis.mapper';
import { KisMarketProvider } from './kis/kis.provider';

/** Collect every daily row returned by KIS; the existing provider only returns the latest row. */
@Injectable()
export class KisHistoryProvider implements MarketDataProvider {
  readonly code = 'KIS';
  private failures: Array<{ symbol: string; error: string }> = [];

  constructor(
    private readonly kis: KisMarketProvider,
    private readonly config: ConfigService,
  ) {}

  async fetchLatestEod(options: FetchEodOptions): Promise<NormalizedDailyPrice[]> {
    const symbols = [...new Set(options.externalSymbols ?? [])];
    if (!symbols.length) throw new Error('KIS requires provider_security_map symbols before price sync');
    this.failures = [];
    const exchange = options.exchangeMic === 'XNAS' ? 'NAS'
      : options.exchangeMic === 'XNYS' ? 'NYS'
      : options.exchangeMic === 'ARCX' ? 'AMS' : null;
    const client = this.kis as unknown as {
      fetchDomesticDaily(symbol: string): Promise<KisDailyPriceItem[]>;
      fetchOverseasDaily(symbol: string, exchange: string): Promise<KisOverseasDailyPriceItem[]>;
    };
    const prices: NormalizedDailyPrice[] = [];
    for (const symbol of symbols) {
      try {
        const rows = exchange
          ? (await client.fetchOverseasDaily(symbol, exchange)).map((row) =>
              toNormalizedKisOverseasPrice(row, symbol, options.exchangeMic, exchange))
          : (await client.fetchDomesticDaily(symbol)).map((row) =>
              toNormalizedKisPrice(row, symbol, options.exchangeMic));
        for (const row of rows) {
          if (row && (!options.date || row.tradeDate === options.date)) prices.push(row);
        }
      } catch (cause: any) {
        this.failures.push({ symbol, error: String(cause?.message ?? cause).slice(0, 300) });
      }
      const delay = Math.max(0, Number(this.config.get('KIS_REQUEST_INTERVAL_MS') ?? 100));
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    }
    return prices.sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
  }

  diagnostics() {
    return { failures: [...this.failures] };
  }
}
