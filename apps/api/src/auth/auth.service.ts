import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { Pool, PoolClient } from 'pg';
import { DB_POOL } from '../common/database/database.module';
import { MailService } from '../common/mail/mail.service';
import { AuditService } from '../audit/audit.service';
import { hashToken, newOpaqueToken } from './token.util';
import { ConsentDto, DeleteAccountDto } from './auth.dto';
import { KakaoIdentity, KakaoOidcService } from './kakao-oidc.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DB_POOL) private readonly db: Pool,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly kakao: KakaoOidcService,
  ) {}

  async register(email: string, password: string, consents: ConsentDto[]) {
    const normalizedEmail = email.trim().toLowerCase();
    const verificationToken = newOpaqueToken();
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
      const existing = await client.query('select 1 from app_user where email=$1', [
        normalizedEmail,
      ]);
      if (existing.rowCount) throw new ConflictException('이미 사용 중인 이메일입니다.');

      const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
      const user = await client.query(
        `insert into app_user(email,status_code) values ($1,'PENDING_VERIFICATION')
         returning user_id,email,status_code,created_at`,
        [normalizedEmail],
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
      await this.insertPurposeToken(
        client,
        userId,
        'EMAIL_VERIFY',
        verificationToken,
        this.verificationTtlMinutes(),
      );
      await client.query('commit');
      await this.audit.write({
        actorUserId: userId,
        actionCode: 'AUTH_REGISTER',
        targetType: 'USER',
        targetId: userId,
      });
      const emailSent = await this.sendVerificationEmail(
        userId,
        normalizedEmail,
        verificationToken,
      );
      return { registered: true, verificationRequired: true, emailSent };
    } catch (e) {
      await client.query('rollback');
      throw e;
    } finally {
      client.release();
    }
  }

  async login(email: string, password: string) {
    const result = await this.db.query(
      `select u.user_id,u.email,u.status_code,u.email_verified_at,p.password_hash,
              coalesce(array_agg(r.role_code) filter (where r.role_code is not null),'{}') roles
       from app_user u
       join user_password p on p.user_id=u.user_id
       left join user_role r on r.user_id=u.user_id
       where u.email=$1 and u.deleted_at is null
       group by u.user_id,p.password_hash`,
      [email.trim().toLowerCase()],
    );
    const row = result.rows[0];
    if (!row || !(await argon2.verify(row.password_hash, password))) {
      await this.audit.write({ actionCode: 'AUTH_LOGIN_FAIL', targetType: 'EMAIL' });
      throw new UnauthorizedException('이메일 또는 비밀번호를 확인하세요.');
    }
    if (!row.email_verified_at || row.status_code === 'PENDING_VERIFICATION') {
      throw new ForbiddenException('이메일 인증이 필요합니다.');
    }
    if (row.status_code !== 'ACTIVE') {
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

  async createKakaoNonce() {
    if (!this.config.get<string>('KAKAO_NATIVE_APP_KEY')?.trim()) {
      throw new ServiceUnavailableException('카카오 로그인이 설정되지 않았습니다.');
    }
    const nonce = newOpaqueToken();
    await this.db.query("delete from social_login_nonce where expires_at < now()-interval '1 day'");
    await this.db.query(
      `insert into social_login_nonce(nonce_hash,provider_code,expires_at)
       values($1,'KAKAO',now()+interval '15 minutes')`,
      [hashToken(nonce)],
    );
    return { nonce };
  }

  async kakaoLogin(idToken: string, nonce: string, consents?: ConsentDto[]) {
    const nonceHash = hashToken(nonce);
    const challenge = await this.db.query(
      `select 1 from social_login_nonce
       where nonce_hash=$1 and provider_code='KAKAO' and used_at is null and expires_at>now()`,
      [nonceHash],
    );
    if (!challenge.rowCount)
      throw new UnauthorizedException('카카오 로그인 요청이 만료되었습니다.');
    const identity = await this.kakao.verify(idToken, nonce);
    const client = await this.db.connect();
    let userId: string;
    let created = false;
    try {
      await client.query('begin');
      await client.query('select pg_advisory_xact_lock(hashtext($1))', [
        `social:KAKAO:${identity.subject}`,
      ]);
      const lockedNonce = await client.query(
        `select 1 from social_login_nonce
         where nonce_hash=$1 and provider_code='KAKAO' and used_at is null and expires_at>now()
         for update`,
        [nonceHash],
      );
      if (!lockedNonce.rowCount)
        throw new UnauthorizedException('카카오 로그인 요청이 만료되었습니다.');

      const linked = await client.query(
        `select u.user_id,u.status_code
         from user_social_account sa join app_user u on u.user_id=sa.user_id
         where sa.provider_code='KAKAO' and sa.provider_subject=$1 and u.deleted_at is null
         for update of u,sa`,
        [identity.subject],
      );
      if (linked.rowCount) {
        if (linked.rows[0].status_code !== 'ACTIVE') {
          throw new UnauthorizedException('사용할 수 없는 계정입니다.');
        }
        userId = linked.rows[0].user_id;
        await client.query(
          `update user_social_account set provider_email=$2,updated_at=now()
           where provider_code='KAKAO' and provider_subject=$1`,
          [identity.subject, identity.email],
        );
        await client.query(
          'update app_user set last_login_at=now(),updated_at=now() where user_id=$1',
          [userId],
        );
      } else {
        if (!consents) {
          await client.query('rollback');
          return { consentRequired: true };
        }
        const activeTerms = await this.validateSocialConsents(client, consents);
        const user = await client.query(
          `insert into app_user(email,status_code,last_login_at)
           values(null,'ACTIVE',now()) returning user_id`,
        );
        userId = user.rows[0].user_id;
        await client.query(
          `insert into user_social_account(user_id,provider_code,provider_subject,provider_email)
           values($1,'KAKAO',$2,$3)`,
          [userId, identity.subject, identity.email],
        );
        await client.query("insert into user_role(user_id,role_code) values ($1,'USER')", [userId]);
        const answers = new Map(consents.map((item) => [item.termId, item.agreed]));
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
        created = true;
      }
      await client.query('update social_login_nonce set used_at=now() where nonce_hash=$1', [
        nonceHash,
      ]);
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
    await this.audit.write({
      actorUserId: userId,
      actionCode: created ? 'AUTH_REGISTER' : 'AUTH_LOGIN_SUCCESS',
      targetType: 'USER',
      targetId: userId,
    });
    return this.issueTokens(userId, await this.loadRoles(userId));
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

  async requestEmailVerification(email: string) {
    const result = await this.db.query(
      `select u.user_id,u.email
       from app_user u
       join user_password p on p.user_id=u.user_id
       where u.email=$1 and u.email_verified_at is null and u.deleted_at is null
         and u.status_code in ('ACTIVE','PENDING_VERIFICATION')`,
      [email.trim().toLowerCase()],
    );
    const row = result.rows[0];
    if (row) {
      const token = await this.createPurposeToken(
        row.user_id,
        'EMAIL_VERIFY',
        this.verificationTtlMinutes(),
      );
      if (token) await this.sendVerificationEmail(row.user_id, row.email, token);
    }
    return { ok: true, message: '대상 계정이면 인증 메일을 전송했습니다.' };
  }

  async confirmEmailVerification(token: string) {
    const client = await this.db.connect();
    let userId: string;
    try {
      await client.query('begin');
      const result = await client.query(
        `select vt.user_id
         from verification_token vt
         join app_user u on u.user_id=vt.user_id and u.deleted_at is null
         join user_password p on p.user_id=u.user_id
         where vt.token_hash=$1 and vt.purpose_code='EMAIL_VERIFY'
           and vt.used_at is null and vt.expires_at>now()
         for update of vt,u`,
        [hashToken(token)],
      );
      if (!result.rowCount)
        throw new BadRequestException('유효하지 않거나 만료된 인증 링크입니다.');
      userId = result.rows[0].user_id;
      await client.query(
        `update app_user set email_verified_at=coalesce(email_verified_at,now()),
           status_code='ACTIVE',updated_at=now() where user_id=$1`,
        [userId],
      );
      await client.query(
        `update verification_token set used_at=now()
         where user_id=$1 and purpose_code='EMAIL_VERIFY' and used_at is null`,
        [userId],
      );
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
    await this.audit.write({
      actorUserId: userId,
      actionCode: 'AUTH_EMAIL_VERIFIED',
      targetType: 'USER',
      targetId: userId,
    });
    return this.issueTokens(userId, await this.loadRoles(userId));
  }

  async requestPasswordReset(email: string) {
    const result = await this.db.query(
      `select u.user_id,u.email
       from app_user u
       join user_password p on p.user_id=u.user_id
       where u.email=$1 and u.deleted_at is null
         and u.status_code in ('ACTIVE','PENDING_VERIFICATION')`,
      [email.trim().toLowerCase()],
    );
    const row = result.rows[0];
    if (row) {
      const token = await this.createPurposeToken(
        row.user_id,
        'PASSWORD_RESET',
        this.passwordResetTtlMinutes(),
      );
      if (token) {
        try {
          await this.mail.sendPasswordReset(row.email, token);
        } catch (error) {
          await this.recordMailFailure(row.user_id, 'PASSWORD_RESET', error);
        }
      }
    }
    return { ok: true, message: '대상 계정이면 비밀번호 재설정 메일을 전송했습니다.' };
  }

  async confirmPasswordReset(token: string, newPassword: string) {
    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
    const client = await this.db.connect();
    let userId: string;
    try {
      await client.query('begin');
      const result = await client.query(
        `select vt.user_id
         from verification_token vt
         join app_user u on u.user_id=vt.user_id and u.deleted_at is null
         join user_password p on p.user_id=u.user_id
         where vt.token_hash=$1 and vt.purpose_code='PASSWORD_RESET'
           and vt.used_at is null and vt.expires_at>now()
         for update of vt`,
        [hashToken(token)],
      );
      if (!result.rowCount) {
        throw new BadRequestException('유효하지 않거나 만료된 비밀번호 재설정 링크입니다.');
      }
      userId = result.rows[0].user_id;
      await client.query(
        `update user_password set password_hash=$2,password_changed_at=now(),
           failed_attempts=0,locked_until=null,updated_at=now() where user_id=$1`,
        [userId, passwordHash],
      );
      await client.query(
        `update verification_token set used_at=now()
         where user_id=$1 and purpose_code='PASSWORD_RESET' and used_at is null`,
        [userId],
      );
      await client.query(
        'update user_refresh_token set revoked_at=now() where user_id=$1 and revoked_at is null',
        [userId],
      );
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
    await this.audit.write({
      actorUserId: userId,
      actionCode: 'AUTH_PASSWORD_RESET',
      targetType: 'USER',
      targetId: userId,
    });
    return { ok: true };
  }

  async deleteAccount(userId: string, dto: DeleteAccountDto) {
    let kakaoIdentity: KakaoIdentity | null = null;
    if (dto.kakaoIdToken && dto.kakaoNonce) {
      kakaoIdentity = await this.kakao.verify(dto.kakaoIdToken, dto.kakaoNonce);
      if (Math.abs(Date.now() / 1000 - kakaoIdentity.authenticatedAt) > 10 * 60) {
        throw new UnauthorizedException('카카오 계정으로 다시 인증해 주세요.');
      }
    }
    const client = await this.db.connect();
    try {
      await client.query('begin');
      const account = await client.query(
        `select u.user_id,p.password_hash,
                exists(select 1 from user_social_account s where s.user_id=u.user_id) has_social
         from app_user u
         left join user_password p on p.user_id=u.user_id
         where u.user_id=$1 and u.deleted_at is null
         for update of u`,
        [userId],
      );
      const row = account.rows[0];
      if (!row) throw new UnauthorizedException('사용자 정보를 찾을 수 없습니다.');
      if (row.password_hash) {
        if (!dto.password || !(await argon2.verify(row.password_hash, dto.password))) {
          throw new UnauthorizedException('현재 비밀번호를 확인하세요.');
        }
      } else {
        if (!row.has_social || !kakaoIdentity || !dto.kakaoAccessToken || !dto.kakaoNonce) {
          throw new UnauthorizedException('카카오 계정으로 다시 인증해 주세요.');
        }
        const social = await client.query(
          `select 1 from user_social_account
           where user_id=$1 and provider_code='KAKAO' and provider_subject=$2`,
          [userId, kakaoIdentity.subject],
        );
        if (!social.rowCount) throw new UnauthorizedException('카카오 계정이 일치하지 않습니다.');
        const nonce = await client.query(
          `update social_login_nonce set used_at=now()
           where nonce_hash=$1 and provider_code='KAKAO' and used_at is null and expires_at>now()
           returning nonce_hash`,
          [hashToken(dto.kakaoNonce)],
        );
        if (!nonce.rowCount) throw new UnauthorizedException('카카오 인증 요청이 만료되었습니다.');
        await this.kakao.unlink(dto.kakaoAccessToken, kakaoIdentity.subject);
      }

      const counts = (
        await client.query(
          `select
             (select count(*)::int from watchlist_item i join watchlist w using(watchlist_id) where w.user_id=$1) watchlist_items,
             (select count(*)::int from screen_preset where user_id=$1) presets,
             (select count(*)::int from user_notification where user_id=$1) notifications,
             (select count(*)::int from screen_search_log where user_id=$1) search_logs`,
          [userId],
        )
      ).rows[0];

      await client.query('delete from screen_search_log where user_id=$1', [userId]);
      await client.query(`delete from application_error_log where context_json->>'userId'=$1`, [
        userId,
      ]);
      await client.query(
        `update audit_log set
           target_id=case when target_type='USER' then null else target_id end,
           before_json=null,after_json=null
         where actor_user_id=$1::uuid or (target_type='USER' and target_id=$2::text)`,
        [userId, userId],
      );
      await client.query(
        `insert into audit_log(action_code,target_type,after_json)
         values('AUTH_ACCOUNT_WITHDRAWN','ACCOUNT',$1::jsonb)`,
        [JSON.stringify({ deleted: counts })],
      );
      await client.query('delete from app_user where user_id=$1', [userId]);
      await client.query('commit');
      return { ok: true, deleted: counts };
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async me(userId: string) {
    const result = await this.db.query(
      `select u.user_id,u.email,u.status_code,u.email_verified_at,u.last_login_at,u.created_at,
              exists(select 1 from user_password pw where pw.user_id=u.user_id) has_password,
              (select sa.provider_email from user_social_account sa
               where sa.user_id=u.user_id and sa.provider_code='KAKAO') social_email,
              coalesce((select array_agg(sa.provider_code order by sa.provider_code)
                        from user_social_account sa where sa.user_id=u.user_id),'{}') social_providers,
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

  private async createPurposeToken(userId: string, purpose: string, ttlMinutes: number) {
    const client = await this.db.connect();
    const token = newOpaqueToken();
    try {
      await client.query('begin');
      await client.query('select pg_advisory_xact_lock(hashtext($1))', [
        `auth-token:${userId}:${purpose}`,
      ]);
      const latest = await client.query(
        `select created_at from verification_token
         where user_id=$1 and purpose_code=$2 order by created_at desc limit 1`,
        [userId, purpose],
      );
      const cooldownSeconds = Math.max(
        1,
        Number(this.config.get('AUTH_TOKEN_REQUEST_COOLDOWN_SECONDS') ?? 60),
      );
      if (
        latest.rowCount &&
        Date.now() - new Date(latest.rows[0].created_at).getTime() < cooldownSeconds * 1000
      ) {
        await client.query('rollback');
        return null;
      }
      await client.query(
        `update verification_token set used_at=now()
         where user_id=$1 and purpose_code=$2 and used_at is null`,
        [userId, purpose],
      );
      await this.insertPurposeToken(client, userId, purpose, token, ttlMinutes);
      await client.query('commit');
      return token;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  private insertPurposeToken(
    client: PoolClient,
    userId: string,
    purpose: string,
    token: string,
    ttlMinutes: number,
  ) {
    return client.query(
      `insert into verification_token(user_id,purpose_code,token_hash,expires_at)
       values($1,$2,$3,now()+make_interval(mins=>$4::int))`,
      [userId, purpose, hashToken(token), ttlMinutes],
    );
  }

  private async sendVerificationEmail(userId: string, email: string, token: string) {
    try {
      await this.mail.sendEmailVerification(email, token);
      return true;
    } catch (error) {
      await this.recordMailFailure(userId, 'EMAIL_VERIFY', error);
      return false;
    }
  }

  private async recordMailFailure(userId: string, purpose: string, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(`Authentication email failed (${purpose}): ${message}`);
    await this.db
      .query(
        `insert into application_error_log(error_code,error_class,message,context_json)
         values('AUTH_EMAIL_SEND_FAILED',$1,$2,$3::jsonb)`,
        [
          error instanceof Error ? error.name : 'Error',
          message.slice(0, 2000),
          JSON.stringify({ userId, purpose }),
        ],
      )
      .catch(() => undefined);
  }

  private async loadRoles(userId: string): Promise<string[]> {
    const result = await this.db.query(
      'select role_code from user_role where user_id=$1 order by role_code',
      [userId],
    );
    return result.rows.map((row) => row.role_code);
  }

  private async validateSocialConsents(client: PoolClient, consents: ConsentDto[]) {
    const activeTerms = (
      await client.query(
        `select distinct on (term_code) term_id,term_code,version,is_required
         from terms_document
         where status_code='PUBLISHED' and effective_from<=now()
         order by term_code,effective_from desc,term_id desc`,
      )
    ).rows;
    if (!activeTerms.length) {
      throw new ServiceUnavailableException('가입 약관을 불러올 수 없습니다.');
    }
    const answers = new Map(consents.map((item) => [item.termId, item.agreed]));
    if (
      activeTerms.some((term) => term.is_required && answers.get(Number(term.term_id)) !== true)
    ) {
      throw new BadRequestException('필수 약관에 모두 동의해 주세요.');
    }
    const activeIds = new Set(activeTerms.map((term) => Number(term.term_id)));
    if (consents.some((item) => !activeIds.has(item.termId))) {
      throw new BadRequestException('약관이 변경되었습니다. 화면을 새로 열어 다시 확인해 주세요.');
    }
    return activeTerms;
  }

  private verificationTtlMinutes() {
    return Math.max(5, Number(this.config.get('EMAIL_VERIFICATION_MINUTES') ?? 30));
  }

  private passwordResetTtlMinutes() {
    return Math.max(5, Number(this.config.get('PASSWORD_RESET_MINUTES') ?? 30));
  }
}
