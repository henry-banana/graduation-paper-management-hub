import { SetMetadata } from '@nestjs/common';
export type AccountRole = 'STUDENT' | 'LECTURER' | 'TBM';
export const ROLES_KEY = 'roles';
export const Roles = (...roles: AccountRole[]) => SetMetadata(ROLES_KEY, roles);
