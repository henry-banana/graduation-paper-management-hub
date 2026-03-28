import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response, Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { RefreshTokenRequestDto, RefreshTokenDto } from './dto';
import { GoogleUser } from './strategies/google.strategy';
import { AuthUser } from '../../common/types';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Get('health')
  healthCheck() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {
    // Guard redirects to Google
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(
    @Req() req: Request & { user: GoogleUser },
    @Res() res: Response,
  ): Promise<void> {
    try {
      const authResult = await this.authService.validateGoogleUser(req.user);
      const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
      const callbackUrl = new URL('/auth/callback', frontendUrl);
      callbackUrl.searchParams.set('accessToken', authResult.tokens.accessToken);
      callbackUrl.searchParams.set('refreshToken', authResult.tokens.refreshToken);
      callbackUrl.searchParams.set('expiresIn', String(authResult.tokens.expiresIn));
      res.redirect(callbackUrl.toString());
    } catch (error) {
      const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
      const errorUrl = new URL('/auth/error', frontendUrl);
      if (error instanceof Error) {
        errorUrl.searchParams.set('message', error.message);
      }
      res.redirect(errorUrl.toString());
    }
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body() dto: RefreshTokenRequestDto): Promise<RefreshTokenDto> {
    return this.authService.refreshAccessToken(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshTokenRequestDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }

  @Get('me')
  async getCurrentUser(@CurrentUser() user: AuthUser): Promise<AuthUser> {
    return user;
  }
}