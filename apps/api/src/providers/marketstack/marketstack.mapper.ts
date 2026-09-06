import { NormalizedDailyPrice } from '../core/normalized-models';
import { MarketstackEodItem } from './marketstack.external';

export function toNormalizedPrice(
  item: MarketstackEodItem,
  exchangeMic: string,
): NormalizedDailyPrice | null {
  if (item.close == null || !item.symbol || !item.date) return null;
  return {
    providerCode: 'MARKETSTACK',
    externalSymbol: item.symbol,
    externalExchange: item.exchange ?? null,
    exchangeMic,
    tradeDate: item.date.slice(0, 10),
    open: item.open ?? null,
    high: item.high ?? null,
    low: item.low ?? null,
    close: item.close,
    adjustedClose: item.adj_close ?? null,
    volume: item.volume ?? null,
    currency: null,
  };
}
