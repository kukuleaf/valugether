import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FetchEodOptions, MarketDataProvider } from '../core/market-data.provider';
import { NormalizedDailyPrice } from '../core/normalized-models';
import { KisDailyPriceResponse, KisTokenResponse } from './kis.external';
import { toNormalizedKisPrice } from './kis.mapper';

@Injectable()
export class KisMarketProvider implements MarketDataProvider {
  readonly code = 'KIS';
  private accessToken?: { value: string; expiresAt: number };

  constructor(private readonly config: ConfigService) {}

  async fetchLatestEod(options: FetchEodOptions): Promise<NormalizedDailyPrice[]> {
    const symbols = [...new Set(options.externalSymbols ?? [])];
    if (!symbols.length)
      throw new Error('KIS requires provider_security_map symbols before price sync');

    const result: NormalizedDailyPrice[] = [];
    for (const symbol of symbols) {
      const rows = await this.fetchDaily(symbol);
      for (const row of rows) {
        const normalized = toNormalizedKisPrice(row, symbol, options.exchangeMic);
        if (!normalized) continue;
        if (options.date && normalized.tradeDate !== options.date) continue;
        result.push(normalized);
        break;
      }
      await this.throttle();
    }
    return result;
  }

  private async fetchDaily(symbol: string) {
    const base = this.config.get('KIS_BASE_URL') ?? 'https://openapi.koreainvestment.com:9443';
    const url = new URL(`${base}/uapi/domestic-stock/v1/quotations/inquire-daily-price`);
    url.searchParams.set('FID_COND_MRKT_DIV_CODE', 'J');
    url.searchParams.set('FID_INPUT_ISCD', symbol);
    url.searchParams.set('FID_PERIOD_DIV_CODE', 'D');
    url.searchParams.set('FID_ORG_ADJ_PRC', '1');

    const response = await fetch(url, {
      headers: {
        authorization: `Bearer ${await this.token()}`,
        appkey: this.config.getOrThrow('KIS_APP_KEY'),
        appsecret: this.config.getOrThrow('KIS_APP_SECRET'),
        tr_id: 'FHKST01010400',
        custtype: 'P',
      },
    });
    if (!response.ok) throw new Error(`KIS HTTP ${response.status}`);
    const body = (await response.json()) as KisDailyPriceResponse;
    if (body.rt_cd !== '0')
      throw new Error(`KIS ${body.msg_cd ?? 'UNKNOWN'}: ${body.msg1 ?? 'request failed'}`);
    return body.output ?? [];
  }

  private async token(): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAt > Date.now() + 60_000)
      return this.accessToken.value;
    const base = this.config.get('KIS_BASE_URL') ?? 'https://openapi.koreainvestment.com:9443';
    const response = await fetch(`${base}/oauth2/tokenP`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        appkey: this.config.getOrThrow('KIS_APP_KEY'),
        appsecret: this.config.getOrThrow('KIS_APP_SECRET'),
      }),
    });
    if (!response.ok) throw new Error(`KIS token HTTP ${response.status}`);
    const body = (await response.json()) as KisTokenResponse;
    if (!body.access_token)
      throw new Error(
        `KIS token ${body.error_code ?? 'UNKNOWN'}: ${body.error_description ?? 'missing access token'}`,
      );
    this.accessToken = {
      value: body.access_token,
      expiresAt: Date.now() + Number(body.expires_in ?? 86_400) * 1000,
    };
    return body.access_token;
  }

  private async throttle() {
    const delay = Math.max(0, Number(this.config.get('KIS_REQUEST_INTERVAL_MS') ?? 100));
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  }
}
