import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PeriodsService } from './periods.service';

describe('PeriodsService', () => {
  let service: PeriodsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PeriodsService],
    }).compile();

    service = module.get<PeriodsService>(PeriodsService);
  });

  describe('findAll', () => {
    it('should return all periods with default pagination', async () => {
      const result = await service.findAll({});

      expect(result.data).toBeDefined();
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.size).toBe(20);
    });

    it('should filter periods by type', async () => {
      const result = await service.findAll({ type: 'BCTT' });

      expect(result.data.every((p) => p.type === 'BCTT')).toBe(true);
    });

    it('should filter periods by status', async () => {
      const result = await service.findAll({ status: 'OPEN' });

      expect(result.data.every((p) => p.status === 'OPEN')).toBe(true);
    });

    it('should handle pagination correctly', async () => {
      const result = await service.findAll({ page: 1, size: 2 });

      expect(result.data.length).toBeLessThanOrEqual(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.size).toBe(2);
    });
  });

  describe('findById', () => {
    it('should return period by ID', async () => {
      const result = await service.findById('prd_2026_hk1_bctt');

      expect(result).toBeDefined();
      expect(result?.code).toBe('HK1-2026-BCTT');
    });

    it('should return null for non-existent ID', async () => {
      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findOpenPeriodByType', () => {
    it('should return open BCTT period', async () => {
      const result = await service.findOpenPeriodByType('BCTT');

      expect(result).toBeDefined();
      expect(result?.type).toBe('BCTT');
      expect(result?.status).toBe('OPEN');
    });

    it('should return null if no open period of type exists', async () => {
      const result = await service.findOpenPeriodByType('KLTN');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new period', async () => {
      const result = await service.create({
        code: 'HK2-2026-BCTT',
        type: 'BCTT',
        openDate: '2026-08-01',
        closeDate: '2026-08-15',
      });

      expect(result.id).toBeDefined();
      expect(result.id).toContain('prd_');
    });

    it('should throw BadRequestException for invalid date range', async () => {
      await expect(
        service.create({
          code: 'INVALID',
          type: 'BCTT',
          openDate: '2026-08-15',
          closeDate: '2026-08-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException for duplicate code', async () => {
      await expect(
        service.create({
          code: 'HK1-2026-BCTT',
          type: 'BCTT',
          openDate: '2026-10-01',
          closeDate: '2026-10-15',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('should update period successfully', async () => {
      // First create a new draft period
      const created = await service.create({
        code: 'UPDATE-TEST',
        type: 'KLTN',
        openDate: '2027-01-01',
        closeDate: '2027-01-15',
      });

      const result = await service.update(created.id, {
        code: 'UPDATE-TEST-UPDATED',
      });

      expect(result.updated).toBe(true);
    });

    it('should throw NotFoundException for non-existent period', async () => {
      await expect(
        service.update('nonexistent', { code: 'NEW' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when updating closed period', async () => {
      await expect(
        service.update('prd_2025_hk2_bctt', { code: 'NEW' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException for invalid date range', async () => {
      const created = await service.create({
        code: 'DATE-TEST',
        type: 'BCTT',
        openDate: '2027-02-01',
        closeDate: '2027-02-15',
      });

      await expect(
        service.update(created.id, {
          openDate: '2027-02-20',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('open', () => {
    it('should open a draft period', async () => {
      const result = await service.open('prd_2026_hk1_kltn');

      expect(result.status).toBe('OPEN');
    });

    it('should throw NotFoundException for non-existent period', async () => {
      await expect(service.open('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when period is already open', async () => {
      await expect(service.open('prd_2026_hk1_bctt')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException when trying to reopen closed period', async () => {
      await expect(service.open('prd_2025_hk2_bctt')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('close', () => {
    it('should close an open period', async () => {
      // First open the KLTN period
      await service.open('prd_2026_hk1_kltn');
      
      const result = await service.close('prd_2026_hk1_kltn');

      expect(result.status).toBe('CLOSED');
    });

    it('should throw NotFoundException for non-existent period', async () => {
      await expect(service.close('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when period is already closed', async () => {
      await expect(service.close('prd_2025_hk2_bctt')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException when trying to close draft period', async () => {
      // Create a fresh draft period for this test
      const created = await service.create({
        code: 'CLOSE-DRAFT-TEST',
        type: 'KLTN',
        openDate: '2027-06-01',
        closeDate: '2027-06-15',
      });

      await expect(service.close(created.id)).rejects.toThrow(ConflictException);
    });
  });

  describe('mapToDto', () => {
    it('should map PeriodRecord to PeriodResponseDto correctly', () => {
      const period = {
        id: 'prd_test',
        code: 'TEST',
        type: 'BCTT' as const,
        openDate: '2026-01-01',
        closeDate: '2026-01-15',
        status: 'OPEN' as const,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };

      const dto = service.mapToDto(period);

      expect(dto.id).toBe(period.id);
      expect(dto.code).toBe(period.code);
      expect(dto.type).toBe(period.type);
      expect(dto.openDate).toBe(period.openDate);
      expect(dto.closeDate).toBe(period.closeDate);
      expect(dto.status).toBe(period.status);
    });
  });
});
