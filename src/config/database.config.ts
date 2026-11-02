import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const connectionFromEnv = (
  get: (key: string) => string | number | undefined,
): TypeOrmModuleOptions => {
  // 1. On récupère l'URL complète de Neon
  const url = get('DATABASE_URL') as string;

  // 2. On vérifie qu'elle existe
  if (!url) {
    throw new Error('DATABASE_URL manquant dans le fichier .env');
  }

  // 3. On affiche un petit log pour confirmer (sans afficher le mot de passe)
  console.log(`[database.config] Connexion à Neon via DATABASE_URL`);

  return {
    type: 'postgres',
    url: url, // On utilise l'URL de Neon
    ssl: {
      rejectUnauthorized: false, // Indispensable pour Neon
    },
    synchronize: false, // On utilise les migrations, pas la synchro auto
    autoLoadEntities: true,
  };
};