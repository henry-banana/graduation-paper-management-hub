import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

function getRequiredConfig(configService: ConfigService, key: string): string {
  const value = configService.get<string>(key)?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function parseAbsoluteUrl(rawUrl: string, configKey: string): URL {
  try {
    return new URL(rawUrl);
  } catch {
    throw new Error(`${configKey} must be a valid absolute URL`);
  }
}

export function resolveGoogleCallbackUrl(configService: ConfigService): string {
  const explicitCallbackUrl = configService.get<string>('GOOGLE_CALLBACK_URL')?.trim();
  const nodeEnv = configService.get<string>('NODE_ENV')?.trim();

  if (explicitCallbackUrl) {
    const parsedUrl = parseAbsoluteUrl(explicitCallbackUrl, 'GOOGLE_CALLBACK_URL');

    if (
      nodeEnv === 'production' &&
      LOCAL_HOSTNAMES.has(parsedUrl.hostname)
    ) {
      throw new Error(
        'GOOGLE_CALLBACK_URL cannot point to localhost in production',
      );
    }

    return parsedUrl.toString();
  }

  const renderExternalUrl = configService
    .get<string>('RENDER_EXTERNAL_URL')
    ?.trim();

  if (renderExternalUrl) {
    const renderUrl = parseAbsoluteUrl(renderExternalUrl, 'RENDER_EXTERNAL_URL');
    return new URL('/api/v1/auth/google/callback', renderUrl).toString();
  }

  throw new Error(
    'Missing GOOGLE_CALLBACK_URL. Set GOOGLE_CALLBACK_URL (recommended) or RENDER_EXTERNAL_URL.',
  );
}

export interface GoogleUser {
  email: string;
  name: string;
  picture?: string;
  accessToken: string;
  refreshToken?: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly configService: ConfigService) {
    const clientID = getRequiredConfig(configService, 'GOOGLE_CLIENT_ID');
    const clientSecret = getRequiredConfig(configService, 'GOOGLE_CLIENT_SECRET');
    const callbackURL = resolveGoogleCallbackUrl(configService);

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
    });
  }

  validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const { emails, displayName, photos } = profile;

    const user: GoogleUser = {
      email: emails?.[0]?.value ?? '',
      name: displayName,
      picture: photos?.[0]?.value,
      accessToken,
      refreshToken,
    };

    done(null, user);
  }
}
