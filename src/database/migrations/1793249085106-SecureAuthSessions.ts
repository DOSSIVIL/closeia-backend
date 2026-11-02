import { MigrationInterface, QueryRunner } from "typeorm";

export class SecureAuthSessions1793249085106 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "auth_sessions" ENABLE ROW LEVEL SECURITY');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "auth_sessions" DISABLE ROW LEVEL SECURITY');
  }
}
