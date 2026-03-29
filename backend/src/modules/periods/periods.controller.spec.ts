import { Test, TestingModule } from '@nestjs/testing';
import { PeriodsController } from './periods.controller';
import { PeriodsService, PeriodRecord } from './periods.service';

describe('PeriodsController', () => {
  let controller: PeriodsController;
  let periodsService: jest.Mocked<PeriodsService>;

  const mockPeriod: PeriodRecord = {
    id: 'prd_2026_hk1_bctt',
    code: 'HK1-2026-BCTT',
    type: 'BCTT',
    openDate: '2026-02-01',
    closeDate: '2026-02-10',
    status: 'OPEN',
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
  };

  beforeEach(async () => {
    const mockPeriodsService = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      open: jest.fn(),
      close: jest.fn(),
      mapToDto: jest.fn((period: PeriodRecord) => ({
        id: period.id,
        code: period.code,
        type: period.type,
        openDate: period.openDate,
        closeDate: period.closeDate,
        status: period.status,
        createdAt: period.createdAt,
        updatedAt: period.updatedAt,
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PeriodsController],
      providers: [{ provide: PeriodsService, useValue: mockPeriodsService }],
    }).compile();

    controller = module.get<PeriodsController>(PeriodsController);
    periodsService = module.get(PeriodsService);
  });

  describe('findAll', () => {
    it('should return list of periods with pagination', async () => {
      periodsService.findAll.mockResolvedValue({
        data: [periodsService.mapToDto(mockPeriod)],
        pagination: { page: 1, size: 20, total: 1 },
      });

      const result = await controller.findAll({ page: 1, size: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.meta.requestId).toBeDefined();
    });

    it('should filter periods by type', async () => {
      periodsService.findAll.mockResolvedValue({
        data: [periodsService.mapToDto(mockPeriod)],
        pagination: { page: 1, size: 20, total: 1 },
      });

      const result = await controller.findAll({ type: 'BCTT' });

      expect(result.data[0].type).toBe('BCTT');
    });
  });

  describe('findOne', () => {
    it('should return period by ID', async () => {
      periodsService.findById.mockResolvedValue(mockPeriod);

      const result = await controller.findOne('prd_2026_hk1_bctt');

      expect(result.data.id).toBe('prd_2026_hk1_bctt');
    });

    it('should throw error when period not found', async () => {
      periodsService.findById.mockResolvedValue(null);

      await expect(controller.findOne('nonexistent')).rejects.toThrow(
        'Period not found',
      );
    });
  });

  describe('create', () => {
    it('should create a new period', async () => {
      periodsService.create.mockResolvedValue({ id: 'prd_new' });

      const result = await controller.create({
        code: 'HK2-2026-BCTT',
        type: 'BCTT',
        openDate: '2026-08-01',
        closeDate: '2026-08-15',
      });

      expect(result.data.id).toBe('prd_new');
      expect(result.meta.requestId).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update period successfully', async () => {
      periodsService.update.mockResolvedValue({ updated: true });

      const result = await controller.update('prd_2026_hk1_bctt', {
        code: 'UPDATED',
      });

      expect(result.data.updated).toBe(true);
      expect(result.meta.requestId).toBeDefined();
    });
  });

  describe('open', () => {
    it('should open period successfully', async () => {
      periodsService.open.mockResolvedValue({ status: 'OPEN' });

      const result = await controller.open('prd_2026_hk1_kltn');

      expect(result.data.status).toBe('OPEN');
      expect(result.meta.requestId).toBeDefined();
    });
  });

  describe('close', () => {
    it('should close period successfully', async () => {
      periodsService.close.mockResolvedValue({ status: 'CLOSED' });

      const result = await controller.close('prd_2026_hk1_bctt');

      expect(result.data.status).toBe('CLOSED');
      expect(result.meta.requestId).toBeDefined();
    });
  });
});
