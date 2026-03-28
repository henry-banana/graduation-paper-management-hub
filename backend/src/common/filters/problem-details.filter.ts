import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ProblemDetails, ProblemDetailsError } from '../types';

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
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
    }

    const body: ProblemDetails = {
      type: `https://kltn.hcmute.edu.vn/errors/${status}`,
      title,
      status,
      detail,
      instance: request.url,
      ...(errors ? { errors } : {}),
    };

    response.status(status).json(body);
  }
}
