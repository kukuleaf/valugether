import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { Pool } from 'pg';
import { DB_POOL } from '../common/database/database.module';
import { AuditService } from '../audit/audit.service';
import { hashToken, newOpaqueToken } from './token.util';
import { ConsentDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB_POOL) private readonly db: Pool,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async register(email: string, password: string, consents: ConsentDto[]) {
    const client = await this.db.connect();
    try {
      await client.query('begin');
      const activeTerms = (
        await client.query(
          `select distinct on (term_code) term_id,term_code,version,is_required
           from terms_document
           where status_code='PUBLISHED' and effective_from<=now()
           order by term_code,effective_from desc,term_id desc`,
        )
      ).rows;
      const answers = new Map(consents.map((item) => [item.termId, item.agreed]));
      const missingRequired = activeTerms.filter(
        (term) => term.is_required && answers.get(Number(term.term_id)) !== true,
      );
      if (missingRequired.length) {
        throw new BadRequestException('필수 약관에 모두 동의해 주세요.');
      }
      const activeIds = new Set(activeTerms.map((term) => Number(term.term_id)));
      if (consents.some((item) => !activeIds.has(item.termId))) {
        throw new BadRequestException(
          '약관이 변경되었습니다. 화면을 새로 열어 다시 확인해 주세요.',
        );
      }
      const existing = await client.query('select 1 from app_user where email=$1', [email]);
      if (existing.rowCount) throw new ConflictException('이미 사용 중인 이메일입니다.');

      const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
      const user = await client.query(
        `insert into app_user(email,status_code) values ($1,'ACTIVE') returning user_id,email,status_code,created_at`,
        [email],
      );
      const userId = user.rows[0].user_id as string;
      await client.query('insert into user_password(user_id,password_hash) values ($1,$2)', [
        userId,
        passwordHash,
      ]);
      await client.query("insert into user_role(user_id,role_code) values ($1,'USER')", [userId]);
      for (const term of activeTerms) {
        const termId = Number(term.term_id);
        await client.query(
          `insert into user_consent(user_id,consent_type,version,agreed,term_id)
           values($1,$2,$3,$4,$5)`,
          [userId, term.term_code, term.version, answers.get(termId) ?? false, termId],
        );
      }
      await client.query(
        "insert into watchlist(user_id,watchlist_name,is_default) values ($1,'관심종목',true)",
        [userId],
      );
      await client.query('commit');
      await this.audit.write({
        actorUserId: userId,
        actionCode: 'AUTH_REGISTER',
        targetType: 'USER',
        targetId: userId,
      });
      return this.issueTokens(userId, ['USER']);
    } catch (e) {
      await client.query('rollback');
      throw e;
    } finally {
      client.release();
    }
  }

  async login(email: string, password: string) {
    const result = await this.db.query(
      `select u.user_id,u.email,u.status_code,p.password_hash,
              coalesce(array_agg(r.role_code) filter (where r.role_code is not null),'{}') roles
       from app_user u
       join user_password p on p.user_id=u.user_id
       left join user_role r on r.user_id=u.user_id
       where u.email=$1 and u.deleted_at is null
       group by u.user_id,p.password_hash`,
      [email],
    );
    const row = result.rows[0];
    if (
      !row ||
      row.status_code !== 'ACTIVE' ||
      !(await argon2.verify(row.password_hash, password))
    ) {
      await this.audit.write({ actionCode: 'AUTH_LOGIN_FAIL', targetType: 'EMAIL' });
      throw new UnauthorizedException('이메일 또는 비밀번호를 확인하세요.');
    }
    await this.db.query(
      'update app_user set last_login_at=now(),updated_at=now() where user_id=$1',
      [row.user_id],
    );
    await this.audit.write({
      actorUserId: row.user_id,
      actionCode: 'AUTH_LOGIN_SUCCESS',
      targetType: 'USER',
      targetId: row.user_id,
    });
    return this.issueTokens(row.user_id, row.roles);
  }

  async refresh(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);
    const result = await this.db.query(
      `select rt.refresh_token_id,rt.user_id,
              coalesce(array_agg(ur.role_code) filter (where ur.role_code is not null),'{}') roles
       from user_refresh_token rt
       join app_user u on u.user_id=rt.user_id and u.status_code='ACTIVE' and u.deleted_at is null
       left join user_role ur on ur.user_id=u.user_id
       where rt.token_hash=$1 and rt.revoked_at is null and rt.expires_at > now()
       group by rt.refresh_token_id,rt.user_id`,
      [tokenHash],
    );
    const row = result.rows[0];
    if (!row) throw new UnauthorizedException('유효하지 않은 refresh token입니다.');
    await this.db.query(
      'update user_refresh_token set revoked_at=now() where refresh_token_id=$1',
      [row.refresh_token_id],
    );
    return this.issueTokens(row.user_id, row.roles);
  }

  async logout(refreshToken: string) {
    await this.db.query(
      'update user_refresh_token set revoked_at=now() where token_hash=$1 and revoked_at is null',
      [hashToken(refreshToken)],
    );
    return { ok: true };
  }

  async me(userId: string) {
    const result = await this.db.query(
      `select u.user_id,u.email,u.status_code,u.email_verified_at,u.last_login_at,u.created_at,
              (select count(*)::int from screen_preset p where p.user_id=u.user_id) preset_count,
              (select count(*)::int from watchlist_item i join watchlist w on w.watchlist_id=i.watchlist_id where w.user_id=u.user_id) watchlist_count
       from app_user u where u.user_id=$1 and u.deleted_at is null`,
      [userId],
    );
    if (!result.rowCount) throw new UnauthorizedException('사용자 정보를 찾을 수 없습니다.');
    return result.rows[0];
  }

  private async issueTokens(userId: string, roles: string[]) {
    const accessMinutes = Number(this.config.get('JWT_ACCESS_MINUTES') ?? 15);
    const accessToken = await this.jwt.signAsync(
      { sub: userId, roles },
      { secret: this.config.getOrThrow('JWT_ACCESS_SECRET'), expiresIn: accessMinutes * 60 },
    );
    const refreshToken = newOpaqueToken();
    const days = Number(this.config.get('REFRESH_TOKEN_DAYS') ?? 30);
    await this.db.query(
      `insert into user_refresh_token(user_id,token_hash,expires_at)
       values ($1,$2,now()+($3::text || ' days')::interval)`,
      [userId, hashToken(refreshToken), days],
    );
    return { accessToken, refreshToken, tokenType: 'Bearer', expiresInSeconds: accessMinutes * 60 };
  }
}
