import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RateLimitService } from './rate-limit.service';

type HttpRequest = {
  method: string;
  originalUrl: string;
  ip?: string;
  socket?: { remoteAddress?: string };
};

type HttpResponse = {
  setHeader(name: string, value: string | number): void;
};

type Policy = {
  scope: string;
  limit: number;
  windowSeconds: number;
};

const AUTH_PATHS = new Set([
  '/auth/register',
  '/auth/login',
  '/auth/refresh',
  '/auth/email-verification/request',
  '/auth/email-verification/confirm',
  '/auth/password-reset/request',
  '/auth/password-reset/confirm',
]);

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly limiter: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext) {
    if ((this.config.get<string>('RATE_LIMIT_ENABLED') ?? 'true').toLowerCase() === 'false') {
      return true;
    }
    const http = context.switchToHttp();
    const request = http.getRequest<HttpRequest>();
    const response = http.getResponse<HttpResponse>();
    const policy = this.policy(request);
    if (!policy) return true;

    const identity = request.ip ?? request.socket?.remoteAddress ?? 'unknown';
    const result = await this.limiter.consume(
      `${policy.scope}:${this.path(request)}`,
      identity,
      policy.limit,
      policy.windowSeconds,
    );
    response.setHeader('x-ratelimit-limit', policy.limit);
    response.setHeader('x-ratelimit-remaining', result.remaining);
    response.setHeader('x-ratelimit-reset', result.retryAfterSeconds);
    if (result.count <= policy.limit) return true;

    response.setHeader('retry-after', result.retryAfterSeconds);
    throw new HttpException(
      { message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.', error: 'Too Many Requests' },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private policy(request: HttpRequest): Policy | undefined {
    if (request.method === 'OPTIONS') return undefined;
    const path = this.path(request);
    if (request.method === 'POST' && AUTH_PATHS.has(path)) {
      return {
        scope: 'auth',
        limit: this.positiveInt('AUTH_RATE_LIMIT_MAX', 10),
        windowSeconds: this.positiveInt('AUTH_RATE_LIMIT_WINDOW_SECONDS', 60),
      };
    }
    if (request.method === 'POST' && path === '/screening/search') {
      return {
        scope: 'screening',
        limit: this.positiveInt('SEARCH_RATE_LIMIT_MAX', 30),
        windowSeconds: this.positiveInt('SEARCH_RATE_LIMIT_WINDOW_SECONDS', 60),
      };
    }
    return undefined;
  }

  private path(request: HttpRequest) {
    const path = request.originalUrl.split('?')[0];
    return path.startsWith('/api/') ? path.slice(4) : path;
  }

  private positiveInt(key: string, fallback: number) {
    const value = Number(this.config.get<string>(key) ?? fallback);
    return Number.isSafeInteger(value) && value > 0 ? value : fallback;
  }
}
