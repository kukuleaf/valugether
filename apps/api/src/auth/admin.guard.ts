import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const roles: string[] = context.switchToHttp().getRequest().user?.roles ?? [];
    if (!roles.includes('ADMIN')) throw new ForbiddenException('관리자 권한이 필요합니다.');
    return true;
  }
}
