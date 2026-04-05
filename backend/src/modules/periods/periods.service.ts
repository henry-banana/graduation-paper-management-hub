import {
  Injectable,
  Logger,
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
  private readonly logger = new Logger(PeriodsService.name);

  constructor(private readonly periodsRepository: PeriodsRepository) {}

  async findAll(query: GetPeriodsQueryDto): Promise<PaginatedResult<PeriodResponseDto>> {
    this.logger.log(
      `[findAll:start] type=${query.type ?? '-'} status=${query.status ?? '-'} page=${query.page ?? 1} size=${query.size ?? 20}`,
    );
    let periods = await this.periodsRepository.findAll();
    const totalRaw = periods.length;

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
    this.logger.log(
      `[findAll:success] totalRaw=${totalRaw} filtered=${total} returned=${paginatedPeriods.length} page=${page} size=${size}`,
    );

    return {
      data: paginatedPeriods.map((p) => this.mapToDto(p)),
      pagination: { page, size, total },
    };
  }

  async findById(id: string): Promise<PeriodRecord | null> {
    this.logger.log(`[findById:start] periodId=${id}`);
    const period = await this.periodsRepository.findById(id);
    if (!period) {
      this.logger.warn(`[findById:notFound] periodId=${id}`);
      return null;
    }

    this.logger.log(`[findById:success] periodId=${id} status=${period.status}`);
    return period;
  }

  async findOpenPeriodByType(type: PeriodType): Promise<PeriodRecord | null> {
    this.logger.log(`[findOpenPeriodByType:start] type=${type}`);
    const period = await this.periodsRepository.findFirst(
      (p) => p.type === type && p.status === 'OPEN',
    );

    if (!period) {
      this.logger.warn(`[findOpenPeriodByType:notFound] type=${type}`);
      return null;
    }

    this.logger.log(`[findOpenPeriodByType:success] type=${type} periodId=${period.id}`);
    return period;
  }

  async create(dto: CreatePeriodDto): Promise<{ id: string }> {
    this.logger.log(
      `[create:start] code=${dto.code} type=${dto.type} openDate=${dto.openDate} closeDate=${dto.closeDate}`,
    );
    const periods = await this.periodsRepository.findAll();

    // Validate date range
    if (new Date(dto.closeDate) <= new Date(dto.openDate)) {
      this.logger.warn(
        `[create:invalidDateRange] code=${dto.code} openDate=${dto.openDate} closeDate=${dto.closeDate}`,
      );
      throw new BadRequestException('Close date must be after open date');
    }

    if (
      dto.submitStartAt &&
      dto.submitEndAt &&
      new Date(dto.submitEndAt) < new Date(dto.submitStartAt)
    ) {
      this.logger.warn(
        `[create:invalidSubmitRange] code=${dto.code} submitStartAt=${dto.submitStartAt} submitEndAt=${dto.submitEndAt}`,
      );
      throw new BadRequestException('Submission end date must be on or after submission start date');
    }

    // Check for duplicate code
    const existingCode = periods.find((p) => p.code === dto.code);
    if (existingCode) {
      this.logger.warn(
        `[create:conflict] code=${dto.code} reason=DUPLICATE_CODE existingPeriodId=${existingCode.id}`,
      );
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
      this.logger.warn(
        `[create:conflict] code=${dto.code} reason=OVERLAP overlappingPeriodId=${overlapping.id} overlappingCode=${overlapping.code}`,
      );
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
      submitStartAt: dto.submitStartAt,
      submitEndAt: dto.submitEndAt,
      status: 'DRAFT',
      createdAt: now,
      updatedAt: now,
    };

    await this.periodsRepository.create(newPeriod);
    this.logger.log(
      `[create:success] periodId=${newPeriod.id} code=${newPeriod.code} type=${newPeriod.type}`,
    );

    return { id: newPeriod.id };
  }

  async update(
    id: string,
    dto: UpdatePeriodDto,
  ): Promise<{ updated: boolean }> {
    this.logger.log(
      `[update:start] periodId=${id} hasCode=${Boolean(dto.code)} hasOpenDate=${Boolean(dto.openDate)} hasCloseDate=${Boolean(dto.closeDate)}`,
    );
    const period = await this.periodsRepository.findById(id);
    if (!period) {
      this.logger.warn(`[update:notFound] periodId=${id}`);
      throw new NotFoundException('Period not found');
    }
    const periods = await this.periodsRepository.findAll();

    // Cannot update CLOSED period
    if (period.status === 'CLOSED') {
      this.logger.warn(`[update:conflict] periodId=${id} reason=PERIOD_CLOSED`);
      throw new ConflictException('Cannot update a closed period');
    }

    // Validate date range if both dates provided
    const openDate = dto.openDate ?? period.openDate;
    const closeDate = dto.closeDate ?? period.closeDate;
    if (new Date(closeDate) <= new Date(openDate)) {
      this.logger.warn(
        `[update:invalidDateRange] periodId=${id} openDate=${openDate} closeDate=${closeDate}`,
      );
      throw new BadRequestException('Close date must be after open date');
    }

    const submitStartAt = dto.submitStartAt ?? period.submitStartAt;
    const submitEndAt = dto.submitEndAt ?? period.submitEndAt;
    if (
      submitStartAt &&
      submitEndAt &&
      new Date(submitEndAt) < new Date(submitStartAt)
    ) {
      this.logger.warn(
        `[update:invalidSubmitRange] periodId=${id} submitStartAt=${submitStartAt} submitEndAt=${submitEndAt}`,
      );
      throw new BadRequestException('Submission end date must be on or after submission start date');
    }

    // Check for duplicate code
    if (dto.code && dto.code !== period.code) {
      const existingCode = periods.find((p) => p.code === dto.code && p.id !== id);
      if (existingCode) {
        this.logger.warn(
          `[update:conflict] periodId=${id} reason=DUPLICATE_CODE newCode=${dto.code} existingPeriodId=${existingCode.id}`,
        );
        throw new ConflictException('Period with this code already exists');
      }
    }

    // Update fields
    if (dto.code) period.code = dto.code;
    if (dto.openDate) period.openDate = dto.openDate;
    if (dto.closeDate) period.closeDate = dto.closeDate;
    if (dto.submitStartAt !== undefined) period.submitStartAt = dto.submitStartAt;
    if (dto.submitEndAt !== undefined) period.submitEndAt = dto.submitEndAt;
    period.updatedAt = new Date().toISOString();

    await this.periodsRepository.update(period.id, period);
    this.logger.log(`[update:success] periodId=${id} status=${period.status}`);

    return { updated: true };
  }

  async open(id: string): Promise<{ status: PeriodStatus }> {
    this.logger.log(`[open:start] periodId=${id}`);
    const period = await this.periodsRepository.findById(id);
    if (!period) {
      this.logger.warn(`[open:notFound] periodId=${id}`);
      throw new NotFoundException('Period not found');
    }
    const periods = await this.periodsRepository.findAll();

    if (period.status === 'OPEN') {
      this.logger.warn(`[open:conflict] periodId=${id} reason=ALREADY_OPEN`);
      throw new ConflictException('Period is already open');
    }

    if (period.status === 'CLOSED') {
      this.logger.warn(`[open:conflict] periodId=${id} reason=ALREADY_CLOSED`);
      throw new ConflictException('Cannot reopen a closed period');
    }

    // Check if another period of same type is open
    const existingOpen = periods.find(
      (p) => p.id !== id && p.type === period.type && p.status === 'OPEN',
    );
    if (existingOpen) {
      this.logger.warn(
        `[open:conflict] periodId=${id} reason=ANOTHER_OPEN type=${period.type} existingPeriodId=${existingOpen.id}`,
      );
      throw new ConflictException(
        `Another ${period.type} period is already open: ${existingOpen.code}`,
      );
    }

    period.status = 'OPEN';
    period.updatedAt = new Date().toISOString();
    await this.periodsRepository.update(period.id, period);
    this.logger.log(`[open:success] periodId=${id} status=OPEN`);

    return { status: 'OPEN' };
  }

  async close(id: string): Promise<{ status: PeriodStatus }> {
    this.logger.log(`[close:start] periodId=${id}`);
    const period = await this.periodsRepository.findById(id);
    if (!period) {
      this.logger.warn(`[close:notFound] periodId=${id}`);
      throw new NotFoundException('Period not found');
    }

    if (period.status === 'CLOSED') {
      this.logger.warn(`[close:conflict] periodId=${id} reason=ALREADY_CLOSED`);
      throw new ConflictException('Period is already closed');
    }

    if (period.status === 'DRAFT') {
      this.logger.warn(`[close:conflict] periodId=${id} reason=STILL_DRAFT`);
      throw new ConflictException('Cannot close a draft period. Open it first.');
    }

    period.status = 'CLOSED';
    period.updatedAt = new Date().toISOString();
    await this.periodsRepository.update(period.id, period);
    this.logger.log(`[close:success] periodId=${id} status=CLOSED`);

    return { status: 'CLOSED' };
  }

  mapToDto(period: PeriodRecord): PeriodResponseDto {
    return {
      id: period.id,
      code: period.code,
      type: period.type,
      openDate: period.openDate,
      closeDate: period.closeDate,
      submitStartAt: period.submitStartAt,
      submitEndAt: period.submitEndAt,
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
