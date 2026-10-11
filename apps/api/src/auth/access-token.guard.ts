import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Pool } from 'pg';
import { DB_POOL } from '../common/database/database.module';

export interface AuthUser {
  sub: string;
  roles: string[];
}

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(DB_POOL) private readonly db: Pool,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header = String(req.headers.authorization ?? '');
    if (!header.startsWith('Bearer ')) throw new UnauthorizedException();
    let user: AuthUser;
    try {
      user = await this.jwt.verifyAsync<AuthUser>(header.slice(7), {
        secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException();
    }
    const active = await this.db.query(
      `select coalesce((select array_agg(r.role_code) from user_role r
                        where r.user_id=app_user.user_id),'{}') roles from app_user
       where user_id=$1 and status_code='ACTIVE' and deleted_at is null`,
      [user.sub],
    );
    if (!active.rowCount) throw new UnauthorizedException();
    user.roles = active.rows[0].roles;
    req.user = user;
    return true;
  }
}
