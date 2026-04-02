import { ConfigService } from '@nestjs/config';
import { resolveGoogleCallbackUrl } from './google.strategy';

function createConfigService(
  values: Record<string, string | undefined>,
): ConfigService {
  return {
    get: (key: string) => values[key],
  } as ConfigService;
}

describe('resolveGoogleCallbackUrl', () => {
  it('returns GOOGLE_CALLBACK_URL when explicitly configured', () => {
    const configService = createConfigService({
      GOOGLE_CALLBACK_URL:
        'https://graduation-paper-management-hub.onrender.com/api/v1/auth/google/callback',
      NODE_ENV: 'production',
    });

    const callbackUrl = resolveGoogleCallbackUrl(configService);

    expect(callbackUrl).toBe(
      'https://graduation-paper-management-hub.onrender.com/api/v1/auth/google/callback',
    );
  });

  it('builds callback URL from RENDER_EXTERNAL_URL when GOOGLE_CALLBACK_URL is missing', () => {
    const configService = createConfigService({
      RENDER_EXTERNAL_URL: 'https://graduation-paper-management-hub.onrender.com',
      NODE_ENV: 'production',
    });

    const callbackUrl = resolveGoogleCallbackUrl(configService);

    expect(callbackUrl).toBe(
      'https://graduation-paper-management-hub.onrender.com/api/v1/auth/google/callback',
    );
  });

  it('throws when GOOGLE_CALLBACK_URL points to localhost in production', () => {
    const configService = createConfigService({
      GOOGLE_CALLBACK_URL: 'http://localhost:3001/api/v1/auth/google/callback',
      NODE_ENV: 'production',
    });

    expect(() => resolveGoogleCallbackUrl(configService)).toThrow(
      'GOOGLE_CALLBACK_URL cannot point to localhost in production',
    );
  });

  it('throws when GOOGLE_CALLBACK_URL and RENDER_EXTERNAL_URL are both missing', () => {
    const configService = createConfigService({
      NODE_ENV: 'production',
    });

    expect(() => resolveGoogleCallbackUrl(configService)).toThrow(
      'Missing GOOGLE_CALLBACK_URL. Set GOOGLE_CALLBACK_URL (recommended) or RENDER_EXTERNAL_URL.',
    );
  });
});
