import { Injectable } from '@nestjs/common';
import { FinancialDataProvider } from '../core/financial-data.provider';
import { NormalizedFinancialFact } from '../core/normalized-models';
import { DartExternalClient } from './dart.external';

@Injectable()
export class DartProvider implements FinancialDataProvider {
  readonly code = 'DART';
  constructor(private readonly external: DartExternalClient) {}

  async fetchCompanyFacts(_externalCompanyId: string): Promise<NormalizedFinancialFact[]> {
    // Intentionally not guessing accounting mappings here.
    // Implement in Phase 2 using provider_metric_mapping and report/consolidation rules.
    // See docs/06_API_MAPPING.md.
    return [];
  }

  rawClient() {
    return this.external;
  }
}
