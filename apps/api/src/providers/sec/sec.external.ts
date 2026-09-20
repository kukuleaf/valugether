import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NoFinancialDataError } from '../core/financial-data.provider';

@Injectable()
export class SecExternalClient {
  constructor(private readonly config: ConfigService) {}
  async companyFacts(cik: string) {
    const padded = cik.replace(/\D/g, '').padStart(10, '0');
    const ua = this.config.get<string>('SEC_USER_AGENT');
    if (!ua) throw new Error('SEC_USER_AGENT is not configured');
    const r = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${padded}.json`, {
      headers: { 'User-Agent': ua, Accept: 'application/json' },
    });
    if (r.status === 404) throw new NoFinancialDataError('SEC_COMPANY_FACTS_404');
    if (!r.ok) throw new Error(`SEC HTTP ${r.status}`);
    return r.json() as Promise<any>;
  }
}
