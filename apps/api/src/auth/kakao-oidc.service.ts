import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

const KAKAO_ISSUER = 'https://kauth.kakao.com';
const kakaoKeys = createRemoteJWKSet(new URL(`${KAKAO_ISSUER}/.well-known/jwks.json`), {
  timeoutDuration: 5_000,
  cooldownDuration: 30_000,
  cacheMaxAge: 60 * 60 * 1_000,
});

export type KakaoIdentity = {
  subject: string;
  email: string | null;
  authenticatedAt: number;
};

export async function verifyKakaoIdToken(
  idToken: string,
  nonce: string,
  audience: string,
  keys: JWTVerifyGetKey = kakaoKeys,
): Promise<KakaoIdentity> {
  const { payload } = await jwtVerify(idToken, keys, {
    issuer: KAKAO_ISSUER,
    audience,
    algorithms: ['RS256'],
    clockTolerance: '30s',
  });
  if (
    typeof payload.sub !== 'string' ||
    !payload.sub ||
    payload.nonce !== nonce ||
    typeof payload.iat !== 'number' ||
    typeof payload.exp !== 'number' ||
    typeof payload.auth_time !== 'number'
  ) {
    throw new UnauthorizedException('카카오 인증 정보가 올바르지 않습니다.');
  }
  return {
    subject: payload.sub,
    email:
      typeof payload.email === 'string' && payload.email.includes('@')
        ? payload.email.trim().toLowerCase()
        : null,
    authenticatedAt: payload.auth_time,
  };
}

@Injectable()
export class KakaoOidcService {
  constructor(private readonly config: ConfigService) {}

  async verify(idToken: string, nonce: string): Promise<KakaoIdentity> {
    const audience = this.config.get<string>('KAKAO_NATIVE_APP_KEY')?.trim();
    if (!audience) throw new ServiceUnavailableException('카카오 로그인이 설정되지 않았습니다.');
    try {
      return await verifyKakaoIdToken(idToken, nonce, audience);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new UnauthorizedException('카카오 인증 정보가 유효하지 않습니다.');
    }
  }

  async unlink(accessToken: string, expectedSubject: string) {
    const info = await this.request(
      'https://kapi.kakao.com/v1/user/access_token_info',
      accessToken,
    );
    if (String(info.id ?? '') !== expectedSubject) {
      throw new UnauthorizedException('카카오 계정이 일치하지 않습니다.');
    }
    const result = await this.request('https://kapi.kakao.com/v1/user/unlink', accessToken, 'POST');
    if (String(result.id ?? '') !== expectedSubject) {
      throw new BadGatewayException('카카오 연결 해제 결과를 확인할 수 없습니다.');
    }
  }

  private async request(url: string, accessToken: string, method = 'GET') {
    try {
      const response = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(5_000),
      });
      if (response.status === 401) throw new UnauthorizedException('카카오 인증이 만료되었습니다.');
      if (!response.ok) throw new BadGatewayException('카카오 서비스 응답에 문제가 있습니다.');
      return (await response.json()) as { id?: number | string };
    } catch (error) {
      if (error instanceof BadGatewayException || error instanceof UnauthorizedException)
        throw error;
      throw new BadGatewayException('카카오 서비스에 연결할 수 없습니다.');
    }
  }
}
