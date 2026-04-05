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
import * as crypto from 'crypto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { AssignmentsService } from '../assignments/assignments.service';
import {
  RefreshTokenRequestDto,
  RefreshTokenDto,
  GoogleCallbackRequestDto,
} from './dto';
import { GoogleUser } from './strategies/google.strategy';
import { AuthUser, TopicRole } from '../../common/types';

function generateRequestId(): string {
  return `req_${crypto.randomBytes(8).toString('hex')}`;
}

function mapAccountRoleToUiRole(role: AuthUser['role']): 'STUDENT' | 'LECTURER' | 'TBM' {
  if (role === 'STUDENT') {
    return 'STUDENT';
  }

  if (role === 'TBM') {
    return 'TBM';
  }

  return 'LECTURER';
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly assignmentsService: AssignmentsService,
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
  @Post('google/callback')
  @HttpCode(HttpStatus.OK)
  async googleTokenCallback(@Body() dto: GoogleCallbackRequestDto) {
    const authResult = await this.authService.authenticateWithGoogleIdToken(
      dto.idToken,
    );

    return {
      data: {
        accessToken: authResult.tokens.accessToken,
        expiresIn: authResult.tokens.expiresIn,
        user: {
          id: authResult.user.userId,
          email: authResult.user.email,
          accountRole: authResult.user.role,
        },
      },
      meta: { requestId: generateRequestId() },
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Body() dto: RefreshTokenRequestDto,
  ): Promise<{ data: RefreshTokenDto; meta: { requestId: string } }> {
    const token = await this.authService.refreshAccessToken(dto.refreshToken);

    return {
      data: token,
      meta: { requestId: generateRequestId() },
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Body() dto: RefreshTokenRequestDto,
  ): Promise<{ data: { success: boolean }; meta: { requestId: string } }> {
    await this.authService.logout(dto.refreshToken);

    return {
      data: { success: true },
      meta: { requestId: generateRequestId() },
    };
  }

  @Get('me')
  async getCurrentUser(@CurrentUser() user: AuthUser) {
    const profile = await this.authService.getCurrentProfile(user.userId);
    const accountRole = profile?.role ?? user.role;

    // Bug #8 fix: Include topic roles (GVHD, GVPB, TV_HD, etc.) for redirect logic
    let topicRoles: TopicRole[] = [];
    if (accountRole === 'LECTURER') {
      topicRoles = await this.assignmentsService.getActiveTopicRolesForUser(user.userId);
    }

    return {
      data: {
        id: profile?.userId ?? user.userId,
        email: profile?.email ?? user.email,
        fullName: profile?.name ?? user.email,
        accountRole,
        uiRole: mapAccountRoleToUiRole(accountRole),
        topicRoles, // Sub-roles for lecturers (GVHD, GVPB, TV_HD, TK_HD, CT_HD)
      },
      meta: { requestId: generateRequestId() },
    };
  }
}