import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ProblemDetails, ProblemDetailsError } from '../types';
import {
  sanitizeErrorForLog,
  sanitizeForLog,
  serializeForLog,
} from '../logging/log-sanitizer.util';

interface MulterLikeError {
  code: string;
  message?: string;
  field?: string;
}

type RequestWithLogContext = Request & {
  requestId?: string;
  user?: {
    userId?: string;
    email?: string;
    role?: string;
  };
};

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<RequestWithLogContext>();
    const response = ctx.getResponse<Response>();
    const requestId = resolveRequestId(request, response);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let title = 'Internal Server Error';
    let detail = 'An unexpected error occurred';
    let errors: ProblemDetailsError[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = normalizeExceptionPayload(exception.getResponse());
      title = extractString(payload.error) ?? title;
      detail = Array.isArray(payload.message)
        ? 'Validation failed'
        : extractString(payload.message) ?? detail;

      if (Array.isArray(payload.message)) {
        errors = payload.message.map((message) => ({
          field: 'unknown',
          message: String(message),
        }));
      }
    } else if (this.isMulterLikeError(exception)) {
      const mapped = this.mapMulterError(exception);
      status = mapped.status;
      title = mapped.title;
      detail = mapped.detail;

      if (exception.field) {
        errors = [
          {
            field: exception.field,
            message: mapped.detail,
          },
        ];
      }
    }

    // Extract errorCode from exception payload (allows frontend to handle specific errors)
    let errorCode: string | undefined;
    if (exception instanceof HttpException) {
      const payload = normalizeExceptionPayload(exception.getResponse());
      const code = payload.errorCode ?? payload.code;
      if (typeof code === 'string' && code.trim()) {
        errorCode = code.trim();
      }
    }

    this.logException({
      request,
      status,
      title,
      detail,
      errorCode,
      errors,
      exception,
      requestId,
    });

    const body: ProblemDetails & { errorCode?: string } = {
      type: `https://kltn.hcmute.edu.vn/errors/${status}`,
      title,
      status,
      detail,
      instance: request.url,
      requestId,
      ...(errorCode ? { errorCode } : {}),
      ...(errors ? { errors } : {}),
    };

    response.status(status).json(body);
  }

  private isMulterLikeError(exception: unknown): exception is MulterLikeError {
    return (
      typeof exception === 'object' &&
      exception !== null &&
      'code' in exception &&
      typeof (exception as { code?: unknown }).code === 'string'
    );
  }

  private mapMulterError(
    exception: MulterLikeError,
  ): { status: number; title: string; detail: string } {
    if (exception.code === 'LIMIT_FILE_SIZE') {
      return {
        status: HttpStatus.PAYLOAD_TOO_LARGE,
        title: 'Payload Too Large',
        detail: exception.message || 'File too large',
      };
    }

    return {
      status: HttpStatus.BAD_REQUEST,
      title: 'Bad Request',
      detail: exception.message || 'Invalid multipart payload',
    };
  }

  private logException(params: {
    request: RequestWithLogContext;
    requestId: string;
    status: number;
    title: string;
    detail: string;
    errorCode?: string;
    errors?: ProblemDetailsError[];
    exception: unknown;
  }): void {
    const { request, requestId, status, title, detail, errorCode, errors, exception } =
      params;
    const context = {
      requestId,
      method: request.method,
      path: request.url,
      status,
      title,
      detail,
      errorCode,
      actor: sanitizeForLog(request.user ?? null),
      requestPayload: {
        query: sanitizeForLog(request.query),
        params: sanitizeForLog(request.params),
        body: sanitizeForLog(request.body),
      },
      errors,
      exception: sanitizeErrorForLog(exception),
    };

    const message = `HTTP exception captured: ${request.method} ${request.url} status=${status} requestId=${requestId} context=${serializeForLog(
      context,
    )}`;

    if (status >= 500) {
      this.logger.error(message);
      return;
    }

    this.logger.warn(message);
  }
}

function normalizeExceptionPayload(payload: unknown): Record<string, unknown> {
  if (typeof payload === 'string') {
    return { message: payload };
  }

  if (payload && typeof payload === 'object') {
    return payload as Record<string, unknown>;
  }

  return {};
}

function extractString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  return undefined;
}

function resolveRequestId(request: RequestWithLogContext, response: Response): string {
  const fromRequest = extractHeaderValue(request.headers['x-request-id']);
  if (fromRequest) {
    return fromRequest;
  }

  const fromResponseLocals = response.locals?.requestId;
  if (typeof fromResponseLocals === 'string' && fromResponseLocals.trim().length > 0) {
    return fromResponseLocals.trim();
  }

  return 'unknown-request-id';
}

function extractHeaderValue(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  if (Array.isArray(value) && value.length > 0) {
    return extractHeaderValue(value[0]);
  }

  return undefined;
}
