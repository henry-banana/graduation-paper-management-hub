import { EventEmitter } from 'events';
import type { NextFunction, Request, Response } from 'express';
import { createAccessLogMiddleware } from './access-log.middleware';

class MockResponse extends EventEmitter {
  statusCode = 200;

  private readonly headers = new Map<string, string | number>();

  setHeader(name: string, value: string | number): void {
    this.headers.set(name.toLowerCase(), value);
  }

  getHeader(name: string): string | number | undefined {
    return this.headers.get(name.toLowerCase());
  }
}

describe('createAccessLogMiddleware', () => {
  it('logs completed request metadata', () => {
    const nowValues = [1000, 1012];
    const log = jest.fn();
    const middleware = createAccessLogMiddleware({
      logger: { log },
      now: () => nowValues.shift() ?? 1012,
    });

    const request = {
      method: 'GET',
      originalUrl: '/api/v1/health',
      headers: {},
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as Request;
    const response = new MockResponse();
    const next = jest.fn() as NextFunction;

    middleware(request, response as unknown as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    response.emit('finish');

    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('GET /api/v1/health 200 12ms 127.0.0.1'),
    );
  });

  it('prefers x-forwarded-for over socket ip', () => {
    const nowValues = [3000, 3025];
    const log = jest.fn();
    const middleware = createAccessLogMiddleware({
      logger: { log },
      now: () => nowValues.shift() ?? 3025,
    });

    const request = {
      method: 'POST',
      originalUrl: '/api/v1/topics',
      headers: {
        'x-forwarded-for': '203.0.113.10, 10.0.0.8',
      },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as Request;
    const response = new MockResponse();
    response.statusCode = 201;

    middleware(request, response as unknown as Response, jest.fn() as NextFunction);
    response.emit('finish');

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('POST /api/v1/topics 201 25ms 203.0.113.10'),
    );
  });
});
