import { normalizeEmail, parseSchoolEmail } from './school-email';

describe('parseSchoolEmail', () => {
  it.each([
    ['rivoire.dossivil@saintjeaningenieur.org', 'Rivoire', 'Dossivil', 'saintjeaningenieur.org'],
    ['jean-pierre.mbarga@universitesaintjean.org', 'Jean-Pierre', 'Mbarga', 'universitesaintjean.org'],
    ['  Awa.NGONO@CPGESAINTJEAN.ORG ', 'Awa', 'Ngono', 'cpgesaintjean.org'],
    ['paul.kamga2@saintjeanmanagement.org', 'Paul', 'Kamga', 'saintjeanmanagement.org'],
  ])('accepte %s', (input, firstName, lastName, domain) => {
    const r = parseSchoolEmail(input);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toMatchObject({ firstName, lastName, domain });
  });

  it.each([
    'rivoire@saintjeaningenieur.org',
    'rivoire.vianey.dossivil@saintjeaningenieur.org',
    'rivoire..dossivil@saintjeaningenieur.org',
    '.rivoire@saintjeaningenieur.org',
    'rivoire.dossivil.@saintjeaningenieur.org',
    'rivoire.dossivil123@saintjeaningenieur.org',
    'éloïse.nkoa@cpgesaintjean.org',
    'rivoire dossivil@saintjeaningenieur.org',
    'rivoire.dossivil@',
    '@saintjeaningenieur.org',
    'rivoire.dossivil@@saintjeaningenieur.org',
    `${'a'.repeat(250)}.b@saintjeaningenieur.org`,
    '',
  ])('refuse %s', (input) => {
    expect(parseSchoolEmail(input).ok).toBe(false);
  });

  it('normalise les entrées non textuelles en chaîne vide', () => {
    expect(normalizeEmail(undefined)).toBe('');
    expect(normalizeEmail(42)).toBe('');
  });
});