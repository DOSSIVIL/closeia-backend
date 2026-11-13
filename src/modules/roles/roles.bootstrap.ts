import { IsNull, type EntityManager } from 'typeorm';
import { Role } from './entities/role.entity';
import { RoleAssignment } from './entities/role-assignment.entity';
import { DEFAULT_ROLES } from './roles.constants';

/** Crée les rôles par défaut manquants et ajoute les droits par défaut sans en retirer. */
export async function ensureDefaultRoles(em: EntityManager): Promise<void> {
  const repo = em.getRepository(Role);
  for (const def of DEFAULT_ROLES) {
    const existing = await repo.findOneBy({ code: def.code });
    if (!existing) {
      await repo.save(
        repo.create({
          ...def,
          permissions: [...def.permissions],
          documentScopes: [...def.documentScopes],
          isSystem: true,
        }),
      );
      continue;
    }
    const merged = [...new Set([...existing.permissions, ...def.permissions])];
    const mergedScopes = [
      ...new Set([...existing.documentScopes, ...def.documentScopes]),
    ];
    if (
      merged.length !== existing.permissions.length ||
      mergedScopes.length !== existing.documentScopes.length
    ) {
      existing.permissions = merged;
      existing.documentScopes = mergedScopes;
      await repo.save(existing);
    }
  }
}

/** Affecte un rôle à un utilisateur. Sans effet si l'affectation existe déjà. */
export async function assignRole(
  em: EntityManager,
  userId: string,
  roleCode: string,
  schoolId: string | null = null,
): Promise<RoleAssignment> {
  const role = await em.findOneByOrFail(Role, { code: roleCode });
  const repo = em.getRepository(RoleAssignment);
  const existing = await repo.findOne({
    where: { userId, roleId: role.id, schoolId: schoolId ?? IsNull() },
  });
  return (
    existing ?? repo.save(repo.create({ userId, roleId: role.id, schoolId }))
  );
}
