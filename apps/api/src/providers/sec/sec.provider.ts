import { Injectable } from '@nestjs/common';
import { FinancialDataProvider } from '../core/financial-data.provider';
import { NormalizedFinancialFact } from '../core/normalized-models';
import { SecExternalClient } from './sec.external';

@Injectable()
export class SecProvider implements FinancialDataProvider {
  readonly code = 'SEC';
  constructor(private readonly external: SecExternalClient) {}

  async fetchCompanyFacts(externalCompanyId: string): Promise<NormalizedFinancialFact[]> {
    const body = await this.external.companyFacts(externalCompanyId);
    const usGaap = body?.facts?.['us-gaap'] ?? {};
    const mappings: Array<[string, string, string[]]> = [
      [
        'REVENUE',
        'USD',
        ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet'],
      ],
      ['OPERATING_INCOME', 'USD', ['OperatingIncomeLoss']],
      ['NET_INCOME', 'USD', ['NetIncomeLoss', 'ProfitLoss']],
      ['EPS_BASIC', 'USD/shares', ['EarningsPerShareBasic']],
      ['WEIGHTED_AVG_SHARES', 'shares', ['WeightedAverageNumberOfSharesOutstanding']],
      ['CURRENT_ASSETS', 'USD', ['AssetsCurrent']],
      ['TOTAL_ASSETS', 'USD', ['Assets']],
      ['CURRENT_LIABILITIES', 'USD', ['LiabilitiesCurrent']],
      ['TOTAL_LIABILITIES', 'USD', ['Liabilities']],
      [
        'TOTAL_EQUITY',
        'USD',
        [
          'StockholdersEquity',
          'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest',
        ],
      ],
      ['CFO', 'USD', ['NetCashProvidedByUsedInOperatingActivities']],
      ['CAPEX', 'USD', ['PaymentsToAcquirePropertyPlantAndEquipment']],
      [
        'DPS',
        'USD/shares',
        ['CommonStockDividendsPerShareDeclared', 'CommonStockDividendsPerShareCashPaid'],
      ],
    ];
    const output: NormalizedFinancialFact[] = [];
    for (const [metricCode, preferredUnit, tags] of mappings) {
      const concept = tags.map((tag) => usGaap[tag]).find(Boolean);
      if (!concept) continue;
      const units = concept.units?.[preferredUnit] ?? Object.values(concept.units ?? {})[0];
      if (!Array.isArray(units)) continue;
      const annual = units
        .filter(
          (item: any) =>
            item.form === '10-K' &&
            /^CY\d{4}/.test(item.frame ?? '') &&
            (!item.start ||
              (Date.parse(item.end) - Date.parse(item.start)) / (24 * 60 * 60 * 1000) >= 250),
        )
        .sort((a: any, b: any) => String(b.filed).localeCompare(String(a.filed)));
      const seenYears = new Set<number>();
      for (const item of annual) {
        const year = Number(String(item.frame).match(/^CY(\d{4})/)?.[1]);
        if (!year || seenYears.has(year) || !Number.isFinite(Number(item.val))) continue;
        seenYears.add(year);
        output.push({
          providerCode: this.code,
          externalCompanyId,
          metricCode,
          periodType: 'FY',
          fiscalYear: year,
          startDate: item.start,
          endDate: item.end,
          filingDate: item.filed,
          value: metricCode === 'CAPEX' ? -Math.abs(Number(item.val)) : Number(item.val),
          currency: preferredUnit.startsWith('USD') ? 'USD' : undefined,
          unit: preferredUnit,
          sourceReportId: item.accn,
          sourceExternalMetric: concept.label ?? tags[0],
          sourceContextId: item.frame,
        });
        if (seenYears.size >= 4) break;
      }
    }
    return output;
  }

  rawClient() {
    return this.external;
  }
}
