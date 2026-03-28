import { Injectable } from '@nestjs/common';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  components: ComponentHealth[];
}

export interface ComponentHealth {
  name: string;
  status: 'up' | 'down' | 'unknown';
  message?: string;
  latency?: number;
}

@Injectable()
export class HealthService {
  private readonly startTime = Date.now();

  async getHealth(): Promise<HealthStatus> {
    const components = await this.checkComponents();
    const allUp = components.every((c) => c.status === 'up');
    const anyDown = components.some((c) => c.status === 'down');

    return {
      status: anyDown ? 'unhealthy' : allUp ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      components,
    };
  }

  async getReadiness(): Promise<{ ready: boolean; checks: ComponentHealth[] }> {
    const checks = await this.checkComponents();
    const ready = checks.every((c) => c.status === 'up');
    return { ready, checks };
  }

  private async checkComponents(): Promise<ComponentHealth[]> {
    const results: ComponentHealth[] = [];

    // Self check
    results.push({
      name: 'api',
      status: 'up',
      message: 'API server running',
    });

    // Google Sheets check - placeholder
    results.push(await this.checkGoogleSheets());

    // Google Drive check - placeholder
    results.push(await this.checkGoogleDrive());

    return results;
  }

  private async checkGoogleSheets(): Promise<ComponentHealth> {
    try {
      // Placeholder: actual implementation in F03
      const start = Date.now();
      // Simulated check
      await new Promise((resolve) => setTimeout(resolve, 10));
      return {
        name: 'google-sheets',
        status: 'up',
        message: 'Google Sheets API reachable',
        latency: Date.now() - start,
      };
    } catch (error) {
      return {
        name: 'google-sheets',
        status: 'down',
        message: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  private async checkGoogleDrive(): Promise<ComponentHealth> {
    try {
      // Placeholder: actual implementation in F03
      const start = Date.now();
      // Simulated check
      await new Promise((resolve) => setTimeout(resolve, 10));
      return {
        name: 'google-drive',
        status: 'up',
        message: 'Google Drive API reachable',
        latency: Date.now() - start,
      };
    } catch (error) {
      return {
        name: 'google-drive',
        status: 'down',
        message: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }
}
