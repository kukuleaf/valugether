import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const NAVER_TOKEN_URL = 'https://nid.naver.com/oauth2.0/token';
const NAVER_PROFILE_URL = 'https://openapi.naver.com/v1/nid/me';
const NAVER_REVOKE_URL = 'https://nid.naver.com/oauth2.0/revoke';
const TOKEN_PATTERN = /^[A-Za-z0-9+/_=-]+$/;

export type NaverIdentity = {
  subject: string;
  email: string | null;
  /** Server-exchanged token. Never return this value to the app or persist it. */
  accessToken: string;
};

@Injectable()
export class NaverOAuthService {
  constructor(private readonly config: ConfigService) {}

  async verify(refreshToken: string): Promise<NaverIdentity> {
    const credentials = this.credentials();
    if (!this.validToken(refreshToken)) {
      throw new UnauthorizedException('네이버 인증 정보가 유효하지 않습니다.');
    }
    // Profile/verify APIs expose no audience. Exchange the SDK refresh token with
    // this application's credentials, then trust only that server-issued token.
    const tokenResponse = await this.request(NAVER_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        refresh_token: refreshToken,
      }).toString(),
    });
    const token = await this.readJson(tokenResponse);
    if (token.error) this.throwTokenError(token.error);
    if (
      !this.validToken(token.access_token) ||
      typeof token.token_type !== 'string' ||
      token.token_type.toLowerCase() !== 'bearer' ||
      !Number.isFinite(Number(token.expires_in)) ||
      Number(token.expires_in) <= 0
    ) {
      throw new BadGatewayException('네이버 인증 응답을 확인할 수 없습니다.');
    }
    // Naver's documented refresh response does not rotate refresh_token. If the
    // provider changes that contract, do not create a session the SDK cannot renew.
    if (token.refresh_token !== undefined && token.refresh_token !== refreshToken) {
      throw new BadGatewayException('네이버 인증이 갱신되었습니다. 다시 로그인해 주세요.');
    }
    const profileResponse = await this.request(NAVER_PROFILE_URL, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const profile = await this.readJson(profileResponse);
    if (profile.resultcode !== '00') {
      throw new UnauthorizedException('네이버 인증 정보가 유효하지 않습니다.');
    }
    const identity = profile.response;
    if (
      !identity ||
      typeof identity !== 'object' ||
      typeof identity.id !== 'string' ||
      !identity.id.trim() ||
      identity.id.length > 255
    ) {
      throw new BadGatewayException('네이버 계정 정보를 확인할 수 없습니다.');
    }
    const email =
      typeof identity.email === 'string' &&
      identity.email.trim().length <= 320 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.email.trim())
        ? identity.email.trim().toLowerCase()
        : null;
    return { subject: identity.id, email, accessToken: token.access_token };
  }

  async unlink(accessToken: string) {
    const credentials = this.credentials();
    if (!this.validToken(accessToken)) {
      throw new UnauthorizedException('네이버 인증 정보가 유효하지 않습니다.');
    }
    const response = await this.request(NAVER_REVOKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        token: accessToken,
        token_type_hint: 'access_token',
      }).toString(),
    });
    // RFC 7009 endpoint succeeds with HTTP 200 and an empty body, including when
    // the token is already revoked. Do not attempt to parse that body as JSON.
    if (response.status !== 200) {
      throw new BadGatewayException('네이버 연결 해제 결과를 확인할 수 없습니다.');
    }
  }

  private credentials() {
    const clientId = this.config.get<string>('NAVER_CLIENT_ID')?.trim();
    const clientSecret = this.config.get<string>('NAVER_CLIENT_SECRET')?.trim();
    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException('네이버 로그인이 설정되지 않았습니다.');
    }
    return { clientId, clientSecret };
  }

  private validToken(token: unknown): token is string {
    return typeof token === 'string' && token.length >= 20 && token.length <= 4096 && TOKEN_PATTERN.test(token);
  }

  private async readJson(response: Response): Promise<Record<string, any>> {
    try {
      const body: unknown = await response.json();
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid body');
      return body as Record<string, any>;
    } catch {
      throw new BadGatewayException('네이버 서비스 응답을 확인할 수 없습니다.');
    }
  }

  private throwTokenError(error: unknown): never {
    if (error === 'invalid_client' || error === 'unauthorized_client') {
      throw new ServiceUnavailableException('네이버 로그인 설정을 확인해 주세요.');
    }
    if (error === 'server_error' || error === 'temporarily_unavailable') {
      throw new BadGatewayException('네이버 서비스 응답에 문제가 있습니다.');
    }
    throw new UnauthorizedException('네이버 인증 정보가 유효하지 않습니다.');
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    try {
      const response = await fetch(url, {
        ...init,
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
      });
      if (response.status === 400 || response.status === 401 || response.status === 403) {
        if (url === NAVER_TOKEN_URL) {
          const body = await this.readJson(response);
          this.throwTokenError(body.error);
        }
        throw new UnauthorizedException('네이버 인증 정보가 유효하지 않습니다.');
      }
      if (!response.ok) throw new BadGatewayException('네이버 서비스 응답에 문제가 있습니다.');
      return response;
    } catch (error) {
      if (
        error instanceof BadGatewayException ||
        error instanceof UnauthorizedException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }
      // Upstream errors can contain credentials or tokens: never expose/log them.
      throw new BadGatewayException('네이버 서비스에 연결할 수 없습니다.');
    }
  }
}
