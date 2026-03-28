import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TOPIC_ROLES_KEY } from '../decorators/topic-roles.decorator';
import { TopicRole } from '../types';

@Injectable()
export class TopicRolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<TopicRole[]>(TOPIC_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userTopicRoles = (request.user?.topicRoles ?? []) as TopicRole[];

    return requiredRoles.some((role: TopicRole) => userTopicRoles.includes(role));
  }
}
