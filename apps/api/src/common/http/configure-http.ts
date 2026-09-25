import { ValidationPipe, type INestApplication } from '@nestjs/common';
import helmet from 'helmet';

const DEVELOPMENT_ORIGINS = ['http://localhost:3100', 'http://127.0.0.1:3100'];

export function configureHttp(app: INestApplication) {
  app.use(helmet());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );

  const trustProxyHops = parseTrustProxyHops(process.env.TRUST_PROXY_HOPS);
  if (trustProxyHops > 0) {
    app.getHttpAdapter().getInstance().set('trust proxy', trustProxyHops);
  }

  const allowedOrigins = corsAllowedOrigins(process.env);
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => callback(null, origin === undefined || allowedOrigins.has(origin)),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['content-type', 'authorization', 'x-request-id'],
    exposedHeaders: [
      'x-request-id',
      'x-ratelimit-limit',
      'x-ratelimit-remaining',
      'x-ratelimit-reset',
      'retry-after',
    ],
  });
}

export function corsAllowedOrigins(environment: NodeJS.ProcessEnv) {
  const configured = (environment.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const origins = configured.length
    ? configured
    : environment.NODE_ENV === 'production'
      ? []
      : DEVELOPMENT_ORIGINS;
  if (environment.NODE_ENV === 'production' && !origins.length) {
    throw new Error('CORS_ALLOWED_ORIGINS is required in production');
  }
  for (const origin of origins) validateOrigin(origin);
  return new Set(origins);
}

function validateOrigin(origin: string) {
  if (origin === '*') throw new Error('CORS wildcard is not allowed with credentials');
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new Error(`Invalid CORS origin: ${origin}`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) {
    throw new Error(`CORS origin must be an exact http(s) origin: ${origin}`);
  }
}

function parseTrustProxyHops(raw?: string) {
  const value = Number(raw ?? 0);
  if (!Number.isSafeInteger(value) || value < 0 || value > 10) {
    throw new Error('TRUST_PROXY_HOPS must be an integer between 0 and 10');
  }
  return value;
}
