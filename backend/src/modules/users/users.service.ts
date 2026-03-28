import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { AccountRole } from '../../common/types';

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: AccountRole;
  studentId?: string;
  lecturerId?: string;
  department?: string;
  earnedCredits?: number;
  totalQuota?: number;
  quotaUsed?: number;
}

const CACHE_TTL = 300000; // 5 minutes

@Injectable()
export class UsersService {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async findByEmail(email: string): Promise<UserRecord | null> {
    const cacheKey = `user:email:${email}`;
    const cached = await this.cacheManager.get<UserRecord>(cacheKey);
    if (cached) return cached;

    const user = await this.fetchUserFromSheet(email);
    if (user) {
      await this.cacheManager.set(cacheKey, user, CACHE_TTL);
    }
    return user;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const cacheKey = `user:id:${id}`;
    const cached = await this.cacheManager.get<UserRecord>(cacheKey);
    if (cached) return cached;

    const user = await this.fetchUserByIdFromSheet(id);
    if (user) {
      await this.cacheManager.set(cacheKey, user, CACHE_TTL);
    }
    return user;
  }

  async invalidateUserCache(email: string, id: string): Promise<void> {
    await Promise.all([
      this.cacheManager.del(`user:email:${email}`),
      this.cacheManager.del(`user:id:${id}`),
    ]);
  }

  private async fetchUserFromSheet(email: string): Promise<UserRecord | null> {
    // Placeholder: will be replaced with Google Sheets integration in F03
    // For dev mode, return mock data based on email pattern
    if (process.env.NODE_ENV === 'development' || process.env.MOCK_AUTH === 'true') {
      return this.getMockUser(email);
    }
    return null;
  }

  private async fetchUserByIdFromSheet(id: string): Promise<UserRecord | null> {
    // Placeholder: will be replaced with Google Sheets integration in F03
    if (process.env.NODE_ENV === 'development' || process.env.MOCK_AUTH === 'true') {
      return this.getMockUserById(id);
    }
    return null;
  }

  private getMockUser(email: string): UserRecord | null {
    const mockUsers: Record<string, UserRecord> = {
      'student@hcmute.edu.vn': {
        id: 'USR001',
        email: 'student@hcmute.edu.vn',
        name: 'Nguyễn Văn A',
        role: 'STUDENT',
        studentId: '20110001',
        earnedCredits: 120,
      },
      'lecturer@hcmute.edu.vn': {
        id: 'USR002',
        email: 'lecturer@hcmute.edu.vn',
        name: 'Trần Văn B',
        role: 'LECTURER',
        lecturerId: 'GV001',
        department: 'CNTT',
        totalQuota: 10,
        quotaUsed: 3,
      },
      'tbm@hcmute.edu.vn': {
        id: 'USR003',
        email: 'tbm@hcmute.edu.vn',
        name: 'Lê Văn C',
        role: 'TBM',
        lecturerId: 'GV002',
        department: 'CNTT',
      },
    };
    return mockUsers[email] ?? null;
  }

  private getMockUserById(id: string): UserRecord | null {
    const mockUsersById: Record<string, UserRecord> = {
      'USR001': {
        id: 'USR001',
        email: 'student@hcmute.edu.vn',
        name: 'Nguyễn Văn A',
        role: 'STUDENT',
        studentId: '20110001',
        earnedCredits: 120,
      },
      'USR002': {
        id: 'USR002',
        email: 'lecturer@hcmute.edu.vn',
        name: 'Trần Văn B',
        role: 'LECTURER',
        lecturerId: 'GV001',
        department: 'CNTT',
        totalQuota: 10,
        quotaUsed: 3,
      },
      'USR003': {
        id: 'USR003',
        email: 'tbm@hcmute.edu.vn',
        name: 'Lê Văn C',
        role: 'TBM',
        lecturerId: 'GV002',
        department: 'CNTT',
      },
    };
    return mockUsersById[id] ?? null;
  }
}
