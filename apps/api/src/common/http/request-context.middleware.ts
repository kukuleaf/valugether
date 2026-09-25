import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RequestContextService } from './request-context.service';

type HttpRequest = {
  header(name: string): string | undefined;
  method: string;
  originalUrl: string;
  requestId?: string;
};

type HttpResponse = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  once(event: 'finish', listener: () => void): void;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HttpAccess');

  constructor(private readonly context: RequestContextService) {}

  use(request: HttpRequest, response: HttpResponse, next: () => void) {
    const supplied = request.header('x-request-id');
    const requestId =
      supplied && UUID_PATTERN.test(supplied) ? supplied.toLowerCase() : randomUUID();
    const started = process.hrtime.bigint();

    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);
    response.once('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
      this.logger.log(
        JSON.stringify({
          event: 'http_request',
          requestId,
          method: request.method,
          path: request.originalUrl.split('?')[0],
          statusCode: response.statusCode,
          durationMs: Number(durationMs.toFixed(2)),
        }),
      );
    });

    this.context.run(requestId, next);
  }
}
