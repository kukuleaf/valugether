import { ArgumentsHost, Catch, HttpException, Logger, type ExceptionFilter } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { RequestContextService } from './request-context.service';

type HttpRequest = {
  method: string;
  originalUrl: string;
  requestId?: string;
};

type HttpResponse = {
  setHeader(name: string, value: string): void;
  status(statusCode: number): { json(body: unknown): void };
};

type HttpErrorBody = {
  statusCode?: number;
  message?: string | string[];
  error?: string;
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(
    private readonly db: Pool,
    private readonly context: RequestContextService,
  ) {}

  async catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<HttpRequest>();
    const response = http.getResponse<HttpResponse>();
    const statusCode = exception instanceof HttpException ? exception.getStatus() : 500;
    const requestId = request.requestId ?? this.context.requestId() ?? randomUUID();
    const path = request.originalUrl.split('?')[0];
    const body = exception instanceof HttpException ? exception.getResponse() : undefined;
    const details: HttpErrorBody =
      typeof body === 'object' && body !== null
        ? (body as HttpErrorBody)
        : { message: typeof body === 'string' ? body : undefined };
    const message =
      statusCode >= 500
        ? '서버 오류가 발생했습니다.'
        : (details.message ??
          (exception instanceof Error ? exception.message : '요청 처리에 실패했습니다.'));

    response.setHeader('x-request-id', requestId);

    if (statusCode >= 500) {
      const error = exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(
        JSON.stringify({
          event: 'http_exception',
          requestId,
          method: request.method,
          path,
          statusCode,
          errorClass: error.constructor.name,
          message: error.message,
        }),
      );
      try {
        await this.db.query(
          `insert into application_error_log(request_id,error_code,error_class,message,stack_trace,context_json)
           values($1,$2,$3,$4,$5,$6::jsonb)`,
          [
            requestId,
            'HTTP_UNHANDLED_EXCEPTION',
            error.constructor.name,
            error.message.slice(0, 4000),
            error.stack ?? null,
            JSON.stringify({ method: request.method, path, statusCode }),
          ],
        );
      } catch (loggingError) {
        this.logger.error(
          JSON.stringify({
            event: 'application_error_log_failed',
            requestId,
            message: loggingError instanceof Error ? loggingError.message : String(loggingError),
          }),
        );
      }
    }

    response.status(statusCode).json({
      statusCode,
      message,
      ...(details.error ? { error: details.error } : {}),
      requestId,
      timestamp: new Date().toISOString(),
      path,
    });
  }
}
