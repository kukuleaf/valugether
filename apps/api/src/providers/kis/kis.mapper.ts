import { NormalizedDailyPrice } from '../core/normalized-models';
import { KisDailyPriceItem } from './kis.external';

function numberOrNull(value?: string): number | null {
  if (value == null || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isoDate(value?: string): string | null {
  if (!value || !/^\d{8}$/.test(value)) return null;
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

export function toNormalizedKisPrice(
  item: KisDailyPriceItem,
  externalSymbol: string,
  exchangeMic: string,
): NormalizedDailyPrice | null {
  const tradeDate = isoDate(item.stck_bsop_date);
  const close = numberOrNull(item.stck_clpr);
  if (!tradeDate || close == null) return null;

  return {
    providerCode: 'KIS',
    externalSymbol,
    externalExchange: 'KRX',
    exchangeMic,
    tradeDate,
    open: numberOrNull(item.stck_oprc),
    high: numberOrNull(item.stck_hgpr),
    low: numberOrNull(item.stck_lwpr),
    close,
    adjustedClose: close,
    volume: numberOrNull(item.acml_vol),
    currency: 'KRW',
  };
}
