import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import {
  PeriodResponseDto,
  PeriodType,
  PeriodStatus,
  CreatePeriodDto,
  UpdatePeriodDto,
  GetPeriodsQueryDto,
} from './dto';
import { PeriodsRepository } from '../../infrastructure/google-sheets';

export interface PeriodRecord {
  id: string;
  code: string;
  type: PeriodType;
  major?: string;
  openDate: string;
  closeDate: string;
  submitStartAt?: string; // Teacher's StartEx — submission window start
  submitEndAt?: string;   // Teacher's EndEx   — submission window end
  status: PeriodStatus;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    size: number;
    total: number;
  };
}

@Injectable()
export class PeriodsService {
  constructor(private readonly periodsRepository: PeriodsRepository) {}

  async findAll(query: GetPeriodsQueryDto): Promise<PaginatedResult<PeriodResponseDto>> {
    let periods = await this.periodsRepository.findAll();

    // Filter by type
    if (query.type) {
      periods = periods.filter((p) => p.type === query.type);
    }

    // Filter by status
    if (query.status) {
      periods = periods.filter((p) => p.status === query.status);
    }

    // Sort by createdAt descending
    periods.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = periods.length;
    const page = query.page ?? 1;
    const size = query.size ?? 20;
    const start = (page - 1) * size;
    const paginatedPeriods = periods.slice(start, start + size);

    return {
      data: paginatedPeriods.map((p) => this.mapToDto(p)),
      pagination: { page, size, total },
    };
  }

  async findById(id: string): Promise<PeriodRecord | null> {
    return this.periodsRepository.findById(id);
  }

  async findOpenPeriodByType(type: PeriodType): Promise<PeriodRecord | null> {
    return this.periodsRepository.findFirst(
      (p) => p.type === type && p.status === 'OPEN',
    );
  }

  async create(dto: CreatePeriodDto): Promise<{ id: string }> {
    const periods = await this.periodsRepository.findAll();

    // Validate date range
    if (new Date(dto.closeDate) <= new Date(dto.openDate)) {
      throw new BadRequestException('Close date must be after open date');
    }

    // Check for duplicate code
    const existingCode = periods.find((p) => p.code === dto.code);
    if (existingCode) {
      throw new ConflictException('Period with this code already exists');
    }

    // Check for overlapping periods of same type
    const overlapping = periods.find(
      (p) =>
        p.type === dto.type &&
        p.status !== 'CLOSED' &&
        this.datesOverlap(dto.openDate, dto.closeDate, p.openDate, p.closeDate),
    );
    if (overlapping) {
      throw new ConflictException(
        `Overlapping period exists: ${overlapping.code}`,
      );
    }

    const now = new Date().toISOString();
    const newPeriod: PeriodRecord = {
      id: `prd_${crypto.randomBytes(4).toString('hex')}`,
      code: dto.code,
      type: dto.type,
      openDate: dto.openDate,
      closeDate: dto.closeDate,
      status: 'DRAFT',
      createdAt: now,
      updatedAt: now,
    };

    await this.periodsRepository.create(newPeriod);

    return { id: newPeriod.id };
  }

  async update(
    id: string,
    dto: UpdatePeriodDto,
  ): Promise<{ updated: boolean }> {
    const period = await this.periodsRepository.findById(id);
    if (!period) {
      throw new NotFoundException('Period not found');
    }
    const periods = await this.periodsRepository.findAll();

    // Cannot update CLOSED period
    if (period.status === 'CLOSED') {
      throw new ConflictException('Cannot update a closed period');
    }

    // Validate date range if both dates provided
    const openDate = dto.openDate ?? period.openDate;
    const closeDate = dto.closeDate ?? period.closeDate;
    if (new Date(closeDate) <= new Date(openDate)) {
      throw new BadRequestException('Close date must be after open date');
    }

    // Check for duplicate code
    if (dto.code && dto.code !== period.code) {
      const existingCode = periods.find((p) => p.code === dto.code && p.id !== id);
      if (existingCode) {
        throw new ConflictException('Period with this code already exists');
      }
    }

    // Update fields
    if (dto.code) period.code = dto.code;
    if (dto.openDate) period.openDate = dto.openDate;
    if (dto.closeDate) period.closeDate = dto.closeDate;
    period.updatedAt = new Date().toISOString();

    await this.periodsRepository.update(period.id, period);

    return { updated: true };
  }

  async open(id: string): Promise<{ status: PeriodStatus }> {
    const period = await this.periodsRepository.findById(id);
    if (!period) {
      throw new NotFoundException('Period not found');
    }
    const periods = await this.periodsRepository.findAll();

    if (period.status === 'OPEN') {
      throw new ConflictException('Period is already open');
    }

    if (period.status === 'CLOSED') {
      throw new ConflictException('Cannot reopen a closed period');
    }

    // Check if another period of same type is open
    const existingOpen = periods.find(
      (p) => p.id !== id && p.type === period.type && p.status === 'OPEN',
    );
    if (existingOpen) {
      throw new ConflictException(
        `Another ${period.type} period is already open: ${existingOpen.code}`,
      );
    }

    period.status = 'OPEN';
    period.updatedAt = new Date().toISOString();
    await this.periodsRepository.update(period.id, period);

    return { status: 'OPEN' };
  }

  async close(id: string): Promise<{ status: PeriodStatus }> {
    const period = await this.periodsRepository.findById(id);
    if (!period) {
      throw new NotFoundException('Period not found');
    }

    if (period.status === 'CLOSED') {
      throw new ConflictException('Period is already closed');
    }

    if (period.status === 'DRAFT') {
      throw new ConflictException('Cannot close a draft period. Open it first.');
    }

    period.status = 'CLOSED';
    period.updatedAt = new Date().toISOString();
    await this.periodsRepository.update(period.id, period);

    return { status: 'CLOSED' };
  }

  mapToDto(period: PeriodRecord): PeriodResponseDto {
    return {
      id: period.id,
      code: period.code,
      type: period.type,
      openDate: period.openDate,
      closeDate: period.closeDate,
      status: period.status,
      createdAt: period.createdAt,
      updatedAt: period.updatedAt,
    };
  }

  private datesOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string,
  ): boolean {
    const s1 = new Date(start1).getTime();
    const e1 = new Date(end1).getTime();
    const s2 = new Date(start2).getTime();
    const e2 = new Date(end2).getTime();
    return s1 <= e2 && s2 <= e1;
  }
}
