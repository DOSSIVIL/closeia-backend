import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRoleDocumentScopes1793600000001 implements MigrationInterface {
  name = 'AddRoleDocumentScopes1793600000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "roles" ADD "documentScopes" json NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(
      `UPDATE "roles" SET "documentScopes" = CASE "code"
        WHEN 'PLATFORM_ADMIN' THEN '["PLATFORM","SCHOOL","ASSIGNED_SPACES","OWN_DOCUMENTS"]'::json
        WHEN 'SCHOOL_ADMIN' THEN '["SCHOOL","ASSIGNED_SPACES","OWN_DOCUMENTS"]'::json
        WHEN 'STAFF' THEN '["ASSIGNED_SPACES","OWN_DOCUMENTS"]'::json
        WHEN 'STUDENT' THEN '["ASSIGNED_SPACES","OWN_DOCUMENTS"]'::json
        ELSE '[]'::json
      END
      WHERE "isSystem" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "roles" DROP COLUMN "documentScopes"`);
  }
}
