import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ScreeningService } from './screening.service';
import { ScreenSearchDto, SearchHistoryQueryDto } from './screening.dto';
import { OptionalAccessTokenGuard } from '../auth/optional-access-token.guard';
import { AccessTokenGuard } from '../auth/access-token.guard';
@Controller('screening')
export class ScreeningController {
  constructor(private readonly service: ScreeningService) {}
  @Get('strategies') strategies() {
    return this.service.strategies();
  }
  @Post('search') @UseGuards(OptionalAccessTokenGuard) search(
    @Body() dto: ScreenSearchDto,
    @Req() req: any,
  ) {
    return this.service.search(dto, req.user?.sub);
  }
  @Get('history')
  @UseGuards(AccessTokenGuard)
  history(@Req() req: any, @Query() query: SearchHistoryQueryDto) {
    return this.service.history(req.user.sub, query.beforeId, query.limit);
  }
  @Delete('history')
  @UseGuards(AccessTokenGuard)
  clearHistory(@Req() req: any) {
    return this.service.clearHistory(req.user.sub);
  }
  @Delete('history/:id')
  @UseGuards(AccessTokenGuard)
  deleteHistory(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.service.deleteHistory(req.user.sub, id);
  }
}
