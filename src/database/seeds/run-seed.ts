import 'dotenv/config';
import * as argon2 from 'argon2';
import type { EntityManager } from 'typeorm';
import dataSource from '../data-source';
import { School } from '../../modules/schools/entities/school.entity';
import { SchoolDomain } from '../../modules/schools/entities/school-domain.entity';
import { User, UserStatus } from '../../modules/users/entities/user.entity';
import { normalizeEmail, parseSchoolEmail } from '../../modules/schools/school-email';
import { assignRole, ensureDefaultRoles } from '../../modules/roles/roles.bootstrap';
import { RoleCode } from '../../modules/roles/roles.constants';
import { SCHOOLS_SEED } from './schools.seed-data';

async function seedSchools(em: EntityManager): Promise<void> {
  for (const seed of SCHOOLS_SEED) {
    let school = await em.findOneBy(School, { code: seed.code });
    if (!school) {
      school = await em.save(em.create(School, { code: seed.code, name: seed.name, isActive: true }));
      console.log(`+ établissement créé : ${seed.name}`);
    }
    for (const raw of seed.domains) {
      const domain = raw.trim().toLowerCase();
      const existing = await em.findOneBy(SchoolDomain, { domain });
      if (existing) {
        if (existing.schoolId !== school.id) {
          throw new Error(`Le domaine ${domain} est déjà rattaché à un autre établissement.`);
        }
        continue;
      }
      await em.save(em.create(SchoolDomain, { domain, schoolId: school.id }));
      console.log(`+ domaine ajouté : ${domain} -> ${seed.code}`);
    }
  }
}

async function seedAdmin(em: EntityManager): Promise<void> {
  const email = normalizeEmail(process.env.SEED_ADMIN_EMAIL);
  const password = process.env.SEED_ADMIN_PASSWORD ?? '';
  const reset = process.env.SEED_ADMIN_RESET_PASSWORD === 'true';

  const parsed = parseSchoolEmail(email);
  if (!parsed.ok) throw new Error(`SEED_ADMIN_EMAIL invalide (${parsed.reason}). Format : prenom.nom@domaine`);
  if (password.length < 12) throw new Error('SEED_ADMIN_PASSWORD manquant ou trop court (12 caractères minimum).');

  const domain = await em.findOne(SchoolDomain, { where: { domain: parsed.value.domain } });
  if (!domain) throw new Error(`Le domaine ${parsed.value.domain} n'est rattaché à aucun établissement.`);

  let user = await em.findOneBy(User, { email });
  if (!user) {
    user = await em.save(
      em.create(User, {
        email,
        firstName: parsed.value.firstName,
        lastName: parsed.value.lastName,
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
        status: UserStatus.ACTIVE,
        schoolId: domain.schoolId,
      }),
    );
    console.log(`+ administrateur créé : ${email}`);
  } else if (reset) {
    await em.update(User, { id: user.id }, {
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      failedLoginCount: 0,
      lockedUntil: null,
      tokenVersion: () => '`tokenVersion` + 1',
    });
    console.log(`~ mot de passe réinitialisé : ${email}`);
  } else {
    console.log(`= administrateur déjà présent : ${email} (mot de passe inchangé)`);
  }

  await assignRole(em, user.id, RoleCode.PlatformAdmin, null);
}

async function main(): Promise<void> {
  await dataSource.initialize();
  try {
    await dataSource.transaction(async (em) => {
      await ensureDefaultRoles(em);
      await seedSchools(em);
      await seedAdmin(em);
    });
    console.log('Seed terminé.');
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err) => {
  console.error('Seed échoué :', err instanceof Error ? err.message : err);
  process.exit(1);
});