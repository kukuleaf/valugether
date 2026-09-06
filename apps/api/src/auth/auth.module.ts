import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AccessTokenGuard } from './access-token.guard';
import { AdminGuard } from './admin.guard';
import { OptionalAccessTokenGuard } from './optional-access-token.guard';
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, AccessTokenGuard, OptionalAccessTokenGuard, AdminGuard],
  exports: [JwtModule, AccessTokenGuard, OptionalAccessTokenGuard, AdminGuard],
})
export class AuthModule {}
