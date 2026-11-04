import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExtendSchools1793600000000 implements MigrationInterface {
  name = 'ExtendSchools1793600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "schools" ADD "description" text`);
    await queryRunner.query(`ALTER TABLE "schools" ADD "adresse" character varying(255)`);
    await queryRunner.query(`ALTER TABLE "schools" ADD "ville" character varying(100)`);
    await queryRunner.query(`ALTER TABLE "schools" ADD "telephone" character varying(30)`);
    await queryRunner.query(`ALTER TABLE "schools" ADD "email_contact" character varying(255)`);
    await queryRunner.query(`ALTER TABLE "schools" ADD "site_web" character varying(255)`);
    await queryRunner.query(`ALTER TABLE "schools" ADD "logo_key" character varying(255)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "schools" DROP COLUMN "logo_key"`);
    await queryRunner.query(`ALTER TABLE "schools" DROP COLUMN "site_web"`);
    await queryRunner.query(`ALTER TABLE "schools" DROP COLUMN "email_contact"`);
    await queryRunner.query(`ALTER TABLE "schools" DROP COLUMN "telephone"`);
    await queryRunner.query(`ALTER TABLE "schools" DROP COLUMN "ville"`);
    await queryRunner.query(`ALTER TABLE "schools" DROP COLUMN "adresse"`);
    await queryRunner.query(`ALTER TABLE "schools" DROP COLUMN "description"`);
  }
}
