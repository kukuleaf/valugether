import { NormalizedFinancialFact } from './normalized-models';

export interface FinancialDataProvider {
  readonly code: string;
  fetchCompanyFacts(externalCompanyId: string): Promise<NormalizedFinancialFact[]>;
}

export class NoFinancialDataError extends Error {
  readonly code = 'NO_DATA';

  constructor(readonly reason: string) {
    super(reason);
    this.name = 'NoFinancialDataError';
  }
}
