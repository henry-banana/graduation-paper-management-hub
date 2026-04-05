import { randomUUID } from 'crypto';
import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { serializeForLog, sanitizeForLog } from '../logging/log-sanitizer.util';
import { AuthUser } from '../types';

type AccessLogger = {
  log: (message: string) => void;
  warn?: (message: string) => void;
  error?: (message: string) => void;
};

export interface AccessLogMiddlewareOptions {
  logger?: AccessLogger;
  now?: () => number;
}

const ACCESS_LOGGER_CONTEXT = 'HTTP';
const REQUEST_ID_HEADER = 'x-request-id';

type RequestLikeUser = Partial<AuthUser> & {
  id?: string;
  sub?: string;
};

type RequestWithLogContext = Request & {
  requestId?: string;
  user?: RequestLikeUser;
};

export function createAccessLogMiddleware(
  options: AccessLogMiddlewareOptions = {},
): (req: Request, res: Response, next: NextFunction) => void {
  const logger = options.logger ?? new Logger(ACCESS_LOGGER_CONTEXT);
  const now = options.now ?? Date.now;

  return (req: Request, res: Response, next: NextFunction): void => {
    const startedAt = now();
    const request = req as RequestWithLogContext;
    const requestId = resolveRequestId(request);
    const method = request.method;
    const url = request.originalUrl || request.url;
    const ipAddress = extractClientIp(request);
    const userAgent = extractUserAgent(request);
    const requestPayload = buildRequestPayload(request);
    const responseWithLocals = res as Response & {
      locals?: Record<string, unknown>;
    };

    request.requestId = requestId;
    if (!responseWithLocals.locals) {
      responseWithLocals.locals = {};
    }
    responseWithLocals.locals.requestId = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);

    logger.log(
      `[incoming] ${method} ${url} requestId=${requestId} ip=${ipAddress} userAgent="${userAgent}" payload=${serializeForLog(
        requestPayload,
      )}`,
    );

    let hasFinished = false;

    res.on('finish', () => {
      hasFinished = true;
      const durationMs = Math.max(0, now() - startedAt);
      const statusCode = res.statusCode;
      const actor = extractActor(request);
      const responseBytes = normalizeContentLength(res.getHeader('content-length'));
      const message =
        `[completed] ${method} ${url} ${statusCode} ${durationMs}ms requestId=${requestId} ip=${ipAddress} bytes=${responseBytes ?? '-'} actor=${serializeForLog(
          actor,
        )} payload=${serializeForLog(requestPayload)}`;

      if (statusCode >= 500) {
        (logger.error ?? logger.warn ?? logger.log).call(logger, message);
        return;
      }

      if (statusCode >= 400) {
        (logger.warn ?? logger.log).call(logger, message);
        return;
      }

      logger.log(message);
    });

    res.on('close', () => {
      if (hasFinished) {
        return;
      }

      const durationMs = Math.max(0, now() - startedAt);
      (logger.warn ?? logger.log).call(
        logger,
        `[aborted] ${method} ${url} requestId=${requestId} ip=${ipAddress} ${durationMs}ms actor=${serializeForLog(
          extractActor(request),
        )}`,
      );
    });

    next();
  };
}

function extractClientIp(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];

  if (typeof forwardedFor === 'string' && forwardedFor.trim().length > 0) {
    return normalizeIpAddress(forwardedFor.split(',')[0]?.trim());
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return normalizeIpAddress(forwardedFor[0]);
  }

  return normalizeIpAddress(req.ip ?? req.socket?.remoteAddress);
}

function normalizeIpAddress(ipAddress?: string): string {
  if (!ipAddress) {
    return '-';
  }

  if (ipAddress.startsWith('::ffff:')) {
    return ipAddress.slice(7);
  }

  return ipAddress;
}

function resolveRequestId(req: RequestWithLogContext): string {
  const fromHeader = req.headers[REQUEST_ID_HEADER];
  const normalized = normalizeHeaderString(fromHeader);
  return normalized && normalized.length > 0 ? normalized : `req_${randomUUID()}`;
}

function normalizeHeaderString(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value) && value.length > 0) {
    const firstValue = value[0];
    if (typeof firstValue === 'string') {
      return firstValue.trim();
    }
  }

  return undefined;
}

function extractUserAgent(req: Request): string {
  const rawHeader = req.headers['user-agent'];

  if (typeof rawHeader === 'string' && rawHeader.trim().length > 0) {
    return rawHeader.slice(0, 300);
  }

  return '-';
}

function normalizeContentLength(
  headerValue: string | number | string[] | undefined,
): number | null {
  if (typeof headerValue === 'number' && Number.isFinite(headerValue)) {
    return headerValue;
  }

  if (typeof headerValue === 'string') {
    const parsed = Number.parseInt(headerValue, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (Array.isArray(headerValue) && headerValue.length > 0) {
    return normalizeContentLength(headerValue[0]);
  }

  return null;
}

function buildRequestPayload(req: Request): Record<string, unknown> {
  return {
    query: sanitizeForLog(req.query),
    params: sanitizeForLog(req.params),
    body: sanitizeForLog(req.body),
  };
}

function extractActor(req: RequestWithLogContext): Record<string, unknown> | null {
  const user = req.user;
  if (!user) {
    return null;
  }

  const userId = extractFirstString(user.userId, user.id, user.sub);
  const email = typeof user.email === 'string' ? user.email : undefined;
  const role = typeof user.role === 'string' ? user.role : undefined;

  if (!userId && !email && !role) {
    return null;
  }

  return {
    userId: userId ?? '-',
    email,
    role,
  };
}

function extractFirstString(...values: Array<unknown>): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return undefined;
}
