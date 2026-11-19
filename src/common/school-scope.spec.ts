import { NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from './decorators/current-user.decorator';
import { assertSchoolInScope } from './school-scope';

const SCHOOL_A = '11111111-1111-4111-8111-111111111111';
const SCHOOL_B = '22222222-2222-4222-8222-222222222222';

const userOf = (schoolId: string | null, roles: string[]): AuthenticatedUser => ({
  id: 'u', email: 'a.b@a.org', schoolId, roles, permissions: [], sessionId: 's',
});

describe('assertSchoolInScope', () => {
  it('laisse un administrateur d’école agir sur son établissement', () => {
    expect(() => assertSchoolInScope(userOf(SCHOOL_A, ['SCHOOL_ADMIN']), SCHOOL_A)).not.toThrow();
  });

  it('répond 404 à un administrateur de l’école A qui cible l’école B', () => {
    expect(() => assertSchoolInScope(userOf(SCHOOL_A, ['SCHOOL_ADMIN']), SCHOOL_B)).toThrow(NotFoundException);
  });

  it('répond 404 à un utilisateur sans établissement', () => {
    expect(() => assertSchoolInScope(userOf(null, ['SCHOOL_ADMIN']), SCHOOL_A)).toThrow(NotFoundException);
  });

  it('laisse l’administrateur plateforme agir sur tout établissement', () => {
    expect(() => assertSchoolInScope(userOf(SCHOOL_A, ['PLATFORM_ADMIN']), SCHOOL_B)).not.toThrow();
    expect(() => assertSchoolInScope(userOf(null, ['PLATFORM_ADMIN']), SCHOOL_B)).not.toThrow();
  });
});
