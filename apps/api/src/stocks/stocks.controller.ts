import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { StocksService } from './stocks.service';

class StockListQueryDto {
  @IsOptional() @IsIn(['KR', 'US']) marketCode?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
}

@Controller('stocks')
export class StocksController {
  constructor(private readonly service: StocksService) {}
  @Get() list(@Query() query: StockListQueryDto) {
    return this.service.list(query.marketCode, query.limit ?? 50);
  }
  @Get(':id/prices')
  prices(@Param('id', ParseIntPipe) id: number, @Query('range') range?: string) {
    return this.service.priceHistory(id, range);
  }
  @Get(':id') detail(@Param('id', ParseIntPipe) id: number) {
    return this.service.detail(id);
  }
}
