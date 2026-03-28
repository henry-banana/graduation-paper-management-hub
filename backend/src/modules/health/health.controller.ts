import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  async health(@Res() res: Response): Promise<void> {
    const status = await this.healthService.getHealth();
    const httpStatus = status.status === 'healthy' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
    res.status(httpStatus).json(status);
  }

  @Public()
  @Get('ready')
  async readiness(@Res() res: Response): Promise<void> {
    const result = await this.healthService.getReadiness();
    const httpStatus = result.ready ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
    res.status(httpStatus).json(result);
  }

  @Public()
  @Get('live')
  liveness(): { alive: boolean; timestamp: string } {
    return { alive: true, timestamp: new Date().toISOString() };
  }
}
