export interface NormalizedDailyPrice {
  providerCode: string;
  externalSymbol: string;
  externalExchange?: string | null;
  exchangeMic: string;
  tradeDate: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  adjustedClose: number | null;
  volume: number | null;
  currency: string | null;
}

export interface NormalizedFinancialFact {
  providerCode: string;
  externalCompanyId: string;
  metricCode: string;
  periodType: 'FY' | 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'TTM';
  fiscalYear?: number;
  fiscalQuarter?: number;
  startDate?: string;
  endDate: string;
  filingDate?: string;
  value: number;
  currency?: string;
  unit?: string;
  sourceReportId: string;
  sourceExternalMetric: string;
  sourceContextId?: string;
}
