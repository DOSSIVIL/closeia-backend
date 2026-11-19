import { NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from './decorators/current-user.decorator';
import { RoleCode } from '../modules/roles/roles.constants';

export const SCHOOL_NOT_FOUND_MESSAGE = 'Établissement introuvable';

/**
 * Vérifie que l'établissement ciblé fait partie du périmètre de l'utilisateur.
 * L'identifiant vient du client : ce n'est qu'une demande. L'administrateur plateforme
 * voit tous les établissements ; les autres seulement le leur (users.schoolId).
 * Une école hors périmètre répond 404, pour ne pas révéler qu'elle existe.
 */
export function assertSchoolInScope(user: AuthenticatedUser, schoolId: string): void {
  if (user.roles.includes(RoleCode.PlatformAdmin)) return;
  if (user.schoolId !== schoolId) throw new NotFoundException(SCHOOL_NOT_FOUND_MESSAGE);
}
