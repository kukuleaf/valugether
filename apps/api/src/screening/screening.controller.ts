import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ScreeningService } from './screening.service';
import { ScreenSearchDto } from './screening.dto';
import { OptionalAccessTokenGuard } from '../auth/optional-access-token.guard';
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
}
