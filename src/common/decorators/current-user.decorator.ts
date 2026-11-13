import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { DocumentScope } from '../../modules/roles/roles.constants';

export interface AuthenticatedUser {
  id: string;
  email: string;
  schoolId: string | null;
  roles: string[];
  permissions: string[];
  documentScopes: DocumentScope[];
  sessionId: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser =>
    ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user,
);
