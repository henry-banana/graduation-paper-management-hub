import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { AccountRole } from '../../common/types';
import {
  GetUsersQueryDto,
  SupervisorOptionDto,
  UpdateUserProfileDto,
  UserResponseDto,
} from './dto';
import { UsersRepository } from '../../infrastructure/google-sheets';

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: AccountRole;
  studentId?: string;
  lecturerId?: string;
  department?: string;
  heDaoTao?: string;
  earnedCredits?: number;
  requiredCredits?: number;
  completedBcttScore?: number;
  totalQuota?: number;
  quotaUsed?: number;
  phone?: string;
  expertise?: string;
  isActive?: boolean;
  createdAt?: string;
}

interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    size: number;
    total: number;
  };
}

// 0 = disabled in dev so sheet edits reflect instantly; 5 min in prod
const CACHE_TTL = process.env.NODE_ENV === 'production' ? 180_000 : 0;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly usersRepository: UsersRepository,
  ) {}

  async findByEmail(email: string): Promise<UserRecord | null> {
    this.logger.log(`[findByEmail:start] email=${email}`);
    const cacheKey = `user:email:${email}`;
    const cached = await this.cacheManager.get<UserRecord>(cacheKey);
    if (cached) {
      this.logger.log(`[findByEmail:cacheHit] email=${email} userId=${cached.id}`);
      return cached;
    }

    const user = await this.fetchUserFromSheet(email);
    if (user) {
      await this.cacheManager.set(cacheKey, user, CACHE_TTL);
      this.logger.log(
        `[findByEmail:success] email=${email} userId=${user.id} source=sheet cached=true ttlMs=${CACHE_TTL}`,
      );
      return user;
    }

    this.logger.warn(`[findByEmail:notFound] email=${email}`);
    return null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    this.logger.log(`[findById:start] userId=${id}`);
    const cacheKey = `user:id:${id}`;
    const cached = await this.cacheManager.get<UserRecord>(cacheKey);
    if (cached) {
      this.logger.log(`[findById:cacheHit] userId=${id}`);
      return cached;
    }

    const user = await this.fetchUserByIdFromSheet(id);
    if (user) {
      await this.cacheManager.set(cacheKey, user, CACHE_TTL);
      this.logger.log(
        `[findById:success] userId=${id} source=sheet cached=true ttlMs=${CACHE_TTL}`,
      );
      return user;
    }

    this.logger.warn(`[findById:notFound] userId=${id}`);
    return null;
  }

  async findAll(query: GetUsersQueryDto): Promise<PaginatedResult<UserResponseDto>> {
    this.logger.log(
      `[findAll:start] queryRole=${query.role ?? '-'} query=${query.q ?? '-'} page=${query.page ?? 1} size=${query.size ?? 20}`,
    );
    let users = await this.usersRepository.findAll();
    const totalRaw = users.length;

    // Filter by role
    if (query.role) {
      users = users.filter((u) => u.role === query.role);
    }

    // Search by name or email
    if (query.q) {
      const searchLower = query.q.toLowerCase();
      users = users.filter(
        (u) =>
          u.name.toLowerCase().includes(searchLower) ||
          u.email.toLowerCase().includes(searchLower),
      );
    }

    const total = users.length;
    const page = query.page ?? 1;
    const size = query.size ?? 20;
    const start = (page - 1) * size;
    const paginatedUsers = users.slice(start, start + size);
    this.logger.log(
      `[findAll:success] totalRaw=${totalRaw} filtered=${total} returned=${paginatedUsers.length} page=${page} size=${size}`,
    );

    return {
      data: paginatedUsers.map((u) => this.mapToDto(u)),
      pagination: { page, size, total },
    };
  }

  async findSupervisorOptions(): Promise<SupervisorOptionDto[]> {
    this.logger.log('[findSupervisorOptions:start]');
    const users = await this.usersRepository.findAll();
    const options = users
      .filter((user) => {
        if (user.role !== 'LECTURER' || user.isActive === false) {
          return false;
        }

        const totalQuota = user.totalQuota ?? 0;
        const quotaUsed = user.quotaUsed ?? 0;
        return totalQuota - quotaUsed > 0;
      })
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((user) => ({
        id: user.id,
        email: user.email,
        fullName: user.name,
        lecturerId: user.lecturerId,
        department: user.department,
        totalQuota: user.totalQuota,
        quotaUsed: user.quotaUsed,
      }));

    this.logger.log(
      `[findSupervisorOptions:success] totalUsers=${users.length} eligible=${options.length}`,
    );

    return options;
  }

  async updateProfile(
    userId: string,
    dto: UpdateUserProfileDto,
  ): Promise<{ updated: boolean }> {
    this.logger.log(
      `[updateProfile:start] userId=${userId} hasFullName=${Boolean(dto.fullName)} hasPhone=${Boolean(dto.phone)}`,
    );
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      this.logger.warn(`[updateProfile:notFound] userId=${userId}`);
      throw new NotFoundException('User not found');
    }

    if (dto.fullName) {
      user.name = dto.fullName;
    }
    if (dto.phone) {
      user.phone = dto.phone;
    }

    await this.usersRepository.update(user.id, user);

    await this.invalidateUserCache(
      user.email,
      user.id,
    );
    this.logger.log(`[updateProfile:success] userId=${userId}`);

    return { updated: true };
  }

  async invalidateUserCache(email: string, id: string): Promise<void> {
    this.logger.log(`[invalidateUserCache:start] email=${email} userId=${id}`);
    await Promise.all([
      this.cacheManager.del(`user:email:${email}`),
      this.cacheManager.del(`user:id:${id}`),
    ]);
    this.logger.log(`[invalidateUserCache:success] email=${email} userId=${id}`);
  }

  mapToDto(user: UserRecord): UserResponseDto {
    const earnedCredits = user.earnedCredits;
    const requiredCredits = user.requiredCredits;
    const completedBcttScore = user.completedBcttScore;

    const hasRequiredCredits =
      typeof earnedCredits === 'number' &&
      typeof requiredCredits === 'number' &&
      earnedCredits >= requiredCredits;

    const hasPassedBctt = typeof completedBcttScore === 'number' && completedBcttScore > 5;

    let kltnEligibilityReason: 'OK' | 'BCTT_INCOMPLETE' | 'BCTT_SCORE_TOO_LOW' | 'INSUFFICIENT_CREDITS' = 'OK';
    if (!hasRequiredCredits) {
      kltnEligibilityReason = 'INSUFFICIENT_CREDITS';
    } else if (completedBcttScore === undefined || completedBcttScore === null) {
      kltnEligibilityReason = 'BCTT_INCOMPLETE';
    } else if (!hasPassedBctt) {
      kltnEligibilityReason = 'BCTT_SCORE_TOO_LOW';
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.name,
      accountRole: user.role,
      studentId: user.studentId,
      lecturerId: user.lecturerId,
      department: user.department,
      earnedCredits,
      requiredCredits,
      completedBcttScore,
      canRegisterKltn: hasRequiredCredits && hasPassedBctt,
      kltnEligibilityReason,
      totalQuota: user.totalQuota,
      quotaUsed: user.quotaUsed,
      isActive: user.isActive,
    };
  }

  private async fetchUserFromSheet(email: string): Promise<UserRecord | null> {
    this.logger.log(`[fetchUserFromSheet:start] email=${email}`);
    return this.usersRepository.findFirst(
      (u) => u.email.toLowerCase() === email.toLowerCase(),
    );
  }

  private async fetchUserByIdFromSheet(id: string): Promise<UserRecord | null> {
    this.logger.log(`[fetchUserByIdFromSheet:start] userId=${id}`);
    return this.usersRepository.findById(id);
  }
}
