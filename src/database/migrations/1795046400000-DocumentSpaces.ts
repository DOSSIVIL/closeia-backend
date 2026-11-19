import { MigrationInterface, QueryRunner } from 'typeorm';

export class DocumentSpaces1795046400000 implements MigrationInterface {
  name = 'DocumentSpaces1795046400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "document_spaces" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "schoolId" uuid NOT NULL, "name" character varying(150) NOT NULL, "description" text, "isDefault" boolean NOT NULL DEFAULT false, "archivedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_document_spaces" PRIMARY KEY ("id"), CONSTRAINT "CHK_document_space_default_not_archived" CHECK (NOT ("isDefault" AND "archivedAt" IS NOT NULL)))`);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_document_space_name" ON "document_spaces" ("schoolId", "name")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_document_space_default" ON "document_spaces" ("schoolId") WHERE "isDefault"`);
    await queryRunner.query(`ALTER TABLE "document_spaces" ADD CONSTRAINT "FK_document_spaces_school" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

    // Invariant : un espace ne change jamais d'établissement.
    await queryRunner.query(`
      CREATE FUNCTION document_spaces_school_immutable() RETURNS trigger AS $$
      BEGIN
        IF NEW."schoolId" <> OLD."schoolId" THEN
          RAISE EXCEPTION 'document_spaces.schoolId est non modifiable';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`CREATE TRIGGER "trg_document_spaces_school_immutable" BEFORE UPDATE OF "schoolId" ON "document_spaces" FOR EACH ROW EXECUTE FUNCTION document_spaces_school_immutable()`);

    // Chaque établissement existant reçoit son espace par défaut.
    await queryRunner.query(`INSERT INTO "document_spaces" ("schoolId", "name", "isDefault") SELECT "id", 'Général', true FROM "schools"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER "trg_document_spaces_school_immutable" ON "document_spaces"`);
    await queryRunner.query(`DROP FUNCTION document_spaces_school_immutable()`);
    await queryRunner.query(`ALTER TABLE "document_spaces" DROP CONSTRAINT "FK_document_spaces_school"`);
    await queryRunner.query(`DROP INDEX "public"."uq_document_space_default"`);
    await queryRunner.query(`DROP INDEX "public"."uq_document_space_name"`);
    await queryRunner.query(`DROP TABLE "document_spaces"`);
  }
}
