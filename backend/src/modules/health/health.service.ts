import { Injectable } from '@nestjs/common';
import { GoogleSheetsClient } from '../../infrastructure/google-sheets';
import { GoogleDriveClient } from '../../infrastructure/google-drive';

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

  constructor(
    private readonly googleSheetsClient: GoogleSheetsClient,
    private readonly googleDriveClient: GoogleDriveClient,
  ) {}

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

    results.push(await this.checkGoogleSheets());

    results.push(await this.checkGoogleDrive());

    return results;
  }

  private async checkGoogleSheets(): Promise<ComponentHealth> {
    const start = Date.now();

    if (!this.googleSheetsClient.isReady()) {
      return {
        name: 'google-sheets',
        status: 'down',
        message: 'Google Sheets client not configured',
        latency: Date.now() - start,
      };
    }

    try {
      const healthy = await this.googleSheetsClient.healthCheck();
      return {
        name: 'google-sheets',
        status: healthy ? 'up' : 'down',
        message: healthy
          ? 'Google Sheets API reachable'
          : 'Google Sheets API is unavailable',
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
    const start = Date.now();

    if (!this.googleDriveClient.isReady()) {
      return {
        name: 'google-drive',
        status: 'down',
        message: 'Google Drive client not configured',
        latency: Date.now() - start,
      };
    }

    try {
      const healthy = await this.googleDriveClient.healthCheck();
      return {
        name: 'google-drive',
        status: healthy ? 'up' : 'down',
        message: healthy
          ? 'Google Drive API reachable'
          : 'Google Drive API is unavailable',
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
