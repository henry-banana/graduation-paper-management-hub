import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from '../../src/modules/health/health.service';

describe('HealthService', () => {
  let healthService: HealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HealthService],
    }).compile();

    healthService = module.get<HealthService>(HealthService);
  });

  describe('getHealth', () => {
    it('should return healthy status when all components are up', async () => {
      const result = await healthService.getHealth();

      expect(result.status).toBe('healthy');
      expect(result.timestamp).toBeDefined();
      expect(result.uptime).toBeGreaterThanOrEqual(0);
      expect(result.components).toBeInstanceOf(Array);
      expect(result.components.length).toBeGreaterThan(0);
    });

    it('should include api component', async () => {
      const result = await healthService.getHealth();

      const apiComponent = result.components.find((c) => c.name === 'api');
      expect(apiComponent).toBeDefined();
      expect(apiComponent?.status).toBe('up');
    });

    it('should include google-sheets component', async () => {
      const result = await healthService.getHealth();

      const sheetsComponent = result.components.find((c) => c.name === 'google-sheets');
      expect(sheetsComponent).toBeDefined();
    });

    it('should include google-drive component', async () => {
      const result = await healthService.getHealth();

      const driveComponent = result.components.find((c) => c.name === 'google-drive');
      expect(driveComponent).toBeDefined();
    });
  });

  describe('getReadiness', () => {
    it('should return ready status', async () => {
      const result = await healthService.getReadiness();

      expect(result.ready).toBe(true);
      expect(result.checks).toBeInstanceOf(Array);
    });
  });
});
