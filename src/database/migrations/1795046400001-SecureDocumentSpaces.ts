import { MigrationInterface, QueryRunner } from 'typeorm';

export class SecureDocumentSpaces1795046400001 implements MigrationInterface {
  name = 'SecureDocumentSpaces1795046400001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "document_spaces" ENABLE ROW LEVEL SECURITY');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "document_spaces" DISABLE ROW LEVEL SECURITY');
  }
}
