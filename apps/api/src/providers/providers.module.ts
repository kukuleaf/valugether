import { Module } from '@nestjs/common';
import { MarketstackProvider } from './marketstack/marketstack.provider';
import { MockMarketProvider } from './mock/mock-market.provider';
import { ProviderRegistry } from './provider-registry.service';
import { DartExternalClient } from './dart/dart.external';
import { DartProvider } from './dart/dart.provider';
import { SecExternalClient } from './sec/sec.external';
import { SecProvider } from './sec/sec.provider';
import { KisMarketProvider } from './kis/kis.provider';
@Module({
  providers: [
    MarketstackProvider,
    KisMarketProvider,
    MockMarketProvider,
    ProviderRegistry,
    DartExternalClient,
    DartProvider,
    SecExternalClient,
    SecProvider,
  ],
  exports: [ProviderRegistry, DartProvider, SecProvider],
})
export class ProvidersModule {}
