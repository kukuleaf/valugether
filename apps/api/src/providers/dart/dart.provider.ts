import { Injectable } from '@nestjs/common';
import { FinancialDataProvider } from '../core/financial-data.provider';
import { NormalizedFinancialFact } from '../core/normalized-models';
import { DartExternalClient } from './dart.external';

@Injectable()
export class DartProvider implements FinancialDataProvider {
  readonly code = 'DART';
  constructor(private readonly external: DartExternalClient) {}

  async fetchCompanyFacts(externalCompanyId: string): Promise<NormalizedFinancialFact[]> {
    const facts: NormalizedFinancialFact[] = [];
    const seen = new Set<string>();
    const latestFiscalYear = new Date().getUTCFullYear() - 1;
    for (let year = latestFiscalYear; year >= latestFiscalYear - 3; year--) {
      let response = await this.external.fetchAllAccounts(externalCompanyId, year, '11011');
      if (response.status !== '000') {
        response = await this.external.fetchAllAccounts(externalCompanyId, year, '11011', 'OFS');
      }
      if (response.status !== '000') continue;
      for (const account of response.list ?? []) {
        const metricCode = this.metricCode(account.account_id, account.account_nm);
        const value = Number(account.thstrm_amount?.replace(/,/g, ''));
        const key = `${metricCode}:${year}`;
        if (!metricCode || !Number.isFinite(value) || seen.has(key)) continue;
        seen.add(key);
        facts.push({
          providerCode: this.code,
          externalCompanyId,
          metricCode,
          periodType: 'FY',
          fiscalYear: year,
          endDate: `${year}-12-31`,
          filingDate: this.receiptDate(account.rcept_no),
          value,
          currency: account.currency || 'KRW',
          unit: account.currency || 'KRW',
          sourceReportId: account.rcept_no,
          sourceExternalMetric: account.account_id || account.account_nm,
          sourceContextId: account.account_detail || '',
        });
      }
    }
    return facts;
  }

  rawClient() {
    return this.external;
  }

  private metricCode(accountId: string, accountName: string) {
    const value = `${accountId} ${accountName}`.toLowerCase();
    const mappings: Array<[RegExp, string]> = [
      [/operatingincomeloss|영업이익/, 'OPERATING_INCOME'],
      [/revenue|salesrevenuenet|매출액|영업수익/, 'REVENUE'],
      [/profitloss|당기순이익|당기순손익/, 'NET_INCOME'],
      [/cashflowsfromusedinoperatingactivities|영업활동.*현금흐름/, 'CFO'],
      [/currentassets|유동자산/, 'CURRENT_ASSETS'],
      [/assets|자산총계/, 'TOTAL_ASSETS'],
      [/currentliabilities|유동부채/, 'CURRENT_LIABILITIES'],
      [/liabilities|부채총계/, 'TOTAL_LIABILITIES'],
      [/equity|자본총계/, 'TOTAL_EQUITY'],
      [/basicearningslosspershare|기본주당.*익/, 'EPS_BASIC'],
    ];
    return mappings.find(([pattern]) => pattern.test(value))?.[1];
  }

  private receiptDate(receiptNumber: string) {
    return /^\d{8}/.test(receiptNumber)
      ? `${receiptNumber.slice(0, 4)}-${receiptNumber.slice(4, 6)}-${receiptNumber.slice(6, 8)}`
      : undefined;
  }
}
