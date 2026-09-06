import { NormalizedFinancialFact } from './normalized-models';

export interface FinancialDataProvider {
  readonly code: string;
  fetchCompanyFacts(externalCompanyId: string): Promise<NormalizedFinancialFact[]>;
}
