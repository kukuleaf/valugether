import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { FinancialSyncService } from '../src/batch/financial-sync.service';
import { MasterDataSyncService } from '../src/batch/master-data-sync.service';
import { MarketPriceSyncService } from '../src/batch/market-price-sync.service';

async function main() {
  const [step = 'master', market = 'KR', value] = process.argv.slice(2);
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  try {
    let result: unknown;
    if (step === 'master') {
      result = await app.get(MasterDataSyncService).run(market);
    } else if (step === 'financial') {
      result = await app.get(FinancialSyncService).run(market, Number(value ?? 20));
    } else if (step === 'price') {
      const batchCode =
        market === 'XKRX' || market === 'XKOS' ? 'KR_EOD_PRICE_SYNC' : 'US_EOD_PRICE_SYNC';
      result = await app.get(MarketPriceSyncService).run(market, batchCode);
    } else {
      throw new Error('usage: sync-data <master|financial|price> <KR|US|MIC> [limit]');
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
