import { SetMetadata } from '@nestjs/common';
import { TopicRole } from '../types';

export const TOPIC_ROLES_KEY = 'topicRoles';
export const TopicRoles = (...roles: TopicRole[]) => SetMetadata(TOPIC_ROLES_KEY, roles);
