import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';

@Controller('auth')
export class AuthController {
  @Public()
  @Get('health')
  healthCheck() {
    return { status: 'ok' };
  }
}