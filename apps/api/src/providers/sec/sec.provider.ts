import { Injectable } from '@nestjs/common';
import { FinancialDataProvider } from '../core/financial-data.provider';
import { NormalizedFinancialFact } from '../core/normalized-models';
import { SecExternalClient } from './sec.external';

@Injectable()
export class SecProvider implements FinancialDataProvider {
  readonly code = 'SEC';
  constructor(private readonly external: SecExternalClient) {}

  async fetchCompanyFacts(_externalCompanyId: string): Promise<NormalizedFinancialFact[]> {
    // Phase 2: map us-gaap taxonomy to financial_metric via provider_metric_mapping.
    // For bulk sync prefer SEC's nightly companyfacts.zip.
    return [];
  }

  rawClient() {
    return this.external;
  }
}
