import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response, Request } from 'express';

interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  errors?: { field: string; message: string }[];
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let title = 'Internal Server Error';
    let detail = 'An unexpected error occurred';
    let errors: { field: string; message: string }[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse() as Record<string, unknown>;
      title = (res.error as string) || title;
      detail = Array.isArray(res.message) 
        ? 'Validation failed' 
        : (res.message as string) || detail;
      
      if (Array.isArray(res.message)) {
        errors = res.message.map((msg: string) => ({
          field: 'unknown',
          message: msg,
        }));
      }
    }

    const problemDetails: ProblemDetails = {
      type: `https://kltn.hcmute.edu.vn/errors/${status}`,
      title,
      status,
      detail,
      instance: request.url,
      ...(errors && { errors }),
    };

    response.status(status).json(problemDetails);
  }
}
