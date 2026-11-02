export const LOCAL_PART_REGEX = /^[a-z]+(?:-[a-z]+)*\.[a-z]+(?:-[a-z]+)*[0-9]{0,2}$/;
export const DOMAIN_REGEX = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
export const MAX_EMAIL_LENGTH = 254;

export type EmailErrorReason = 'EMPTY' | 'TOO_LONG' | 'FORMAT' | 'LOCAL_PART' | 'DOMAIN' | 'UNKNOWN_DOMAIN';

export const EMAIL_ERROR_MESSAGES: Record<EmailErrorReason, string> = {
  EMPTY: 'Adresse e-mail requise.',
  TOO_LONG: 'Adresse e-mail trop longue.',
  FORMAT: 'Adresse e-mail invalide.',
  LOCAL_PART: 'Adresse non conforme : le format attendu est prenom.nom@domaine-de-votre-établissement.',
  DOMAIN: 'Le domaine de l’adresse e-mail est invalide.',
  UNKNOWN_DOMAIN: 'Ce domaine n’appartient à aucun établissement SpaceHub.',
};

export interface ParsedSchoolEmail {
  email: string;
  localPart: string;
  domain: string;
  firstName: string;
  lastName: string;
}

export type ParseResult =
  | { ok: true; value: ParsedSchoolEmail }
  | { ok: false; reason: Exclude<EmailErrorReason, 'UNKNOWN_DOMAIN'> };

/** Minuscules, espaces retirés, NFKC (neutralise les caractères pleine largeur et assimilés). */
export function normalizeEmail(raw: unknown): string {
  return typeof raw === 'string' ? raw.normalize('NFKC').trim().toLowerCase() : '';
}

const capitalize = (s: string) =>
  s.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('-');

export function parseSchoolEmail(raw: unknown): ParseResult {
  const email = normalizeEmail(raw);
  if (!email) return { ok: false, reason: 'EMPTY' };
  if (email.length > MAX_EMAIL_LENGTH) return { ok: false, reason: 'TOO_LONG' };

  const parts = email.split('@');
  if (parts.length !== 2) return { ok: false, reason: 'FORMAT' };

  const [localPart, domain] = parts;
  if (!LOCAL_PART_REGEX.test(localPart)) return { ok: false, reason: 'LOCAL_PART' };
  if (!DOMAIN_REGEX.test(domain)) return { ok: false, reason: 'DOMAIN' };

  const [first, last] = localPart.split('.');
  return {
    ok: true,
    value: {
      email,
      localPart,
      domain,
      firstName: capitalize(first),
      lastName: capitalize(last.replace(/[0-9]+$/, '')),
    },
  };
}