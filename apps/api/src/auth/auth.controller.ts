import { Body, Controller, Delete, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  EmailRequestDto,
  DeleteAccountDto,
  LoginDto,
  LogoutDto,
  PasswordResetConfirmDto,
  RefreshDto,
  RegisterDto,
  TokenConfirmDto,
} from './auth.dto';
import { AccessTokenGuard } from './access-token.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('register') register(@Body() dto: RegisterDto) {
    return this.auth.register(dto.email, dto.password, dto.consents);
  }
  @Post('login') login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }
  @Post('refresh') refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }
  @Post('logout') logout(@Body() dto: LogoutDto) {
    return this.auth.logout(dto.refreshToken);
  }
  @Post('email-verification/request') requestEmailVerification(@Body() dto: EmailRequestDto) {
    return this.auth.requestEmailVerification(dto.email);
  }
  @Post('email-verification/confirm') confirmEmailVerification(@Body() dto: TokenConfirmDto) {
    return this.auth.confirmEmailVerification(dto.token);
  }
  @Post('password-reset/request') requestPasswordReset(@Body() dto: EmailRequestDto) {
    return this.auth.requestPasswordReset(dto.email);
  }
  @Post('password-reset/confirm') confirmPasswordReset(@Body() dto: PasswordResetConfirmDto) {
    return this.auth.confirmPasswordReset(dto.token, dto.newPassword);
  }
  @Get('me')
  @UseGuards(AccessTokenGuard)
  me(@Req() req: any) {
    return this.auth.me(req.user.sub);
  }
  @Delete('me')
  @UseGuards(AccessTokenGuard)
  deleteAccount(@Req() req: any, @Body() dto: DeleteAccountDto) {
    return this.auth.deleteAccount(req.user.sub, dto.password);
  }
}
