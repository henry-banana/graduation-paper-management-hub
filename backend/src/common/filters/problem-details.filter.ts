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

interface MulterLikeError {
  code: string;
  message?: string;
  field?: string;
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let title = 'Internal Server Error';
    let detail = 'An unexpected error occurred';
    let errors: ProblemDetailsError[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse() as Record<string, unknown>;
      title = (payload.error as string) || title;
      detail = Array.isArray(payload.message)
        ? 'Validation failed'
        : (payload.message as string) || detail;

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
    } else {
      const trace = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(
        `Unhandled exception at ${request.method} ${request.url}`,
        trace,
      );
    }

    // Extract errorCode from exception payload (allows frontend to handle specific errors)
    let errorCode: string | undefined;
    if (exception instanceof HttpException) {
      const payload = exception.getResponse() as Record<string, unknown>;
      const code = payload.errorCode ?? payload.code;
      if (typeof code === 'string' && code.trim()) {
        errorCode = code.trim();
      }
    }

    const body: ProblemDetails & { errorCode?: string } = {
      type: `https://kltn.hcmute.edu.vn/errors/${status}`,
      title,
      status,
      detail,
      instance: request.url,
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
}
