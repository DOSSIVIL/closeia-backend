import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnableExtensions1700000000000 implements MigrationInterface {
  name = 'EnableExtensions1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE SCHEMA IF NOT EXISTS extensions');
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions');
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA extensions'); // pgvector (RAG)
  }

  public async down(): Promise<void> {
    // Les extensions sont conservées volontairement.
  }
}