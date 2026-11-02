export interface SchoolSeed {
  code: string;
  name: string;
  domains: string[];
}

export const SCHOOLS_SEED: SchoolSeed[] = [
  { code: 'SJI', name: 'Institut Universitaire Saint Jean Ingénieur', domains: ['saintjeaningenieur.org'] },
  { code: 'IUSJ', name: 'Institut Universitaire Saint Jean du Cameroun', domains: ['universitesaintjean.org'] },
  { code: 'SJM', name: 'Saint Jean Management', domains: ['saintjeanmanagement.org'] },
  { code: 'CPGE', name: 'CPGE Saint-Jean (Prépa Saint Jean)', domains: ['cpgesaintjean.org'] },
];