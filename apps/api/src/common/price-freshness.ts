import { ConfigService } from '@nestjs/config';

export type PriceFreshnessStatus = 'CURRENT' | 'DELAYED' | 'MISSING';

export function priceMaxAgeDays(config: ConfigService): number {
  const configured = Number(config.get('DATA_QUALITY_PRICE_MAX_AGE_DAYS') ?? 4);
  return Number.isFinite(configured) ? Math.max(1, Math.min(30, configured)) : 4;
}

export function priceFreshnessStatus(
  ageDays: number | null,
  maxAgeDays: number,
): PriceFreshnessStatus {
  if (ageDays == null) return 'MISSING';
  return ageDays > maxAgeDays ? 'DELAYED' : 'CURRENT';
}
