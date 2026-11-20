import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotifications1794800000000 implements MigrationInterface {
  name = 'CreateNotifications1794800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "kind" character varying(10) NOT NULL,
        "title" character varying(180) NOT NULL,
        "message" text NOT NULL,
        "read" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_notifications_kind" CHECK ("kind" IN ('info', 'success', 'warning', 'danger')),
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_user_created" ON "notifications" ("userId", "createdAt")`,
    );
    await queryRunner.query(`
      ALTER TABLE "notifications"
      ADD CONSTRAINT "FK_notifications_user"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP CONSTRAINT "FK_notifications_user"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_notifications_user_created"`,
    );
    await queryRunner.query(`DROP TABLE "notifications"`);
  }
}
