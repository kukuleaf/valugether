import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { StocksService } from './stocks.service';
@Controller('stocks')
export class StocksController {
  constructor(private readonly service: StocksService) {}
  @Get() list(@Query('marketCode') marketCode?: string, @Query('limit') limit?: string) {
    return this.service.list(marketCode, Number(limit ?? 50));
  }
  @Get(':id/prices')
  prices(@Param('id', ParseIntPipe) id: number, @Query('range') range?: string) {
    return this.service.priceHistory(id, range);
  }
  @Get(':id') detail(@Param('id', ParseIntPipe) id: number) {
    return this.service.detail(id);
  }
}
