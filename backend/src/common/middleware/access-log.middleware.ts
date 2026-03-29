import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

type AccessLogger = {
  log: (message: string) => void;
};

export interface AccessLogMiddlewareOptions {
  logger?: AccessLogger;
  now?: () => number;
}

const ACCESS_LOGGER_CONTEXT = 'HTTP';

export function createAccessLogMiddleware(
  options: AccessLogMiddlewareOptions = {},
): (req: Request, res: Response, next: NextFunction) => void {
  const logger = options.logger ?? new Logger(ACCESS_LOGGER_CONTEXT);
  const now = options.now ?? Date.now;

  return (req: Request, res: Response, next: NextFunction): void => {
    const startedAt = now();

    res.on('finish', () => {
      const durationMs = Math.max(0, now() - startedAt);
      const method = req.method;
      const url = req.originalUrl || req.url;
      const statusCode = res.statusCode;
      const ipAddress = extractClientIp(req);

      logger.log(`${method} ${url} ${statusCode} ${durationMs}ms ${ipAddress}`);
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
