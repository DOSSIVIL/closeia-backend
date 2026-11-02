import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1793130839024 implements MigrationInterface {
    name = 'InitSchema1793130839024'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "roles" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "code" character varying(50) NOT NULL, "name" character varying(120) NOT NULL, "description" text, "isSystem" boolean NOT NULL DEFAULT false, "permissions" json NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f6d54f95c31b73fb1bdd8e91d0" ON "roles"  ("code") `);
        await queryRunner.query(`CREATE TABLE "school_domains" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "domain" character varying(190) NOT NULL, "schoolId" uuid NOT NULL, CONSTRAINT "CHK_fdea4f1acfe9f9a8f5357539ed" CHECK (domain = LOWER(domain)), CONSTRAINT "PK_ba8569080d36b1771c4ead0b6f5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_6ae87d5ad4424e163c56480126" ON "school_domains"  ("domain") `);
        await queryRunner.query(`CREATE TABLE "schools" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "code" character varying(20) NOT NULL, "name" character varying(200) NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_95b932e47ac129dd8e23a0db548" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_35e8277da52a915513e3ece8cf" ON "schools"  ("code") `);
        await queryRunner.query(`CREATE TYPE "public"."users_status_enum" AS ENUM('ACTIVE', 'SUSPENDED', 'INVITED')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "email" character varying(254) NOT NULL, "firstName" character varying(100) NOT NULL, "lastName" character varying(100) NOT NULL, "passwordHash" character varying(255), "googleSub" character varying(64), "avatarUrl" character varying(500), "status" "public"."users_status_enum" NOT NULL DEFAULT 'ACTIVE', "schoolId" uuid, "tokenVersion" integer NOT NULL DEFAULT '0', "failedLoginCount" integer NOT NULL DEFAULT '0', "lockedUntil" TIMESTAMP WITH TIME ZONE, "lastLoginAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_9b4f1b5bc7cb79a990d11b249f" CHECK (email = LOWER(email)), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users"  ("email") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_980a19e1db3caa55d366a4e216" ON "users"  ("googleSub") `);
        await queryRunner.query(`INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES ($1, $2, $3, $4, $5, $6)`, ["postgres","public","role_assignments","GENERATED_COLUMN","schoolScope","COALESCE(\"schoolId\"::text, '')"]);
        await queryRunner.query(`CREATE TABLE "role_assignments" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "userId" uuid NOT NULL, "roleId" uuid NOT NULL, "schoolId" uuid, "schoolScope" character varying(36) GENERATED ALWAYS AS (COALESCE("schoolId"::text, '')) STORED NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_fc2df9835ac1d2a34839f113783" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_assignment_scope" ON "role_assignments"  ("userId", "roleId", "schoolScope") `);
        await queryRunner.query(`ALTER TABLE "school_domains" ADD CONSTRAINT "FK_0fff798a606f56611d6e0ccde2f" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_435e192698a6b7d10849295643d" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "role_assignments" ADD CONSTRAINT "FK_4c31464b76da5895e211a5d2099" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "role_assignments" ADD CONSTRAINT "FK_6000ca1e3e8add1eb504f139a7b" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "role_assignments" ADD CONSTRAINT "FK_388639c3541970d8121aab111f0" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "role_assignments" DROP CONSTRAINT "FK_388639c3541970d8121aab111f0"`);
        await queryRunner.query(`ALTER TABLE "role_assignments" DROP CONSTRAINT "FK_6000ca1e3e8add1eb504f139a7b"`);
        await queryRunner.query(`ALTER TABLE "role_assignments" DROP CONSTRAINT "FK_4c31464b76da5895e211a5d2099"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_435e192698a6b7d10849295643d"`);
        await queryRunner.query(`ALTER TABLE "school_domains" DROP CONSTRAINT "FK_0fff798a606f56611d6e0ccde2f"`);
        await queryRunner.query(`DROP INDEX "public"."uq_assignment_scope"`);
        await queryRunner.query(`DROP TABLE "role_assignments"`);
        await queryRunner.query(`DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "database" = $3 AND "schema" = $4 AND "table" = $5`, ["GENERATED_COLUMN","schoolScope","postgres","public","role_assignments"]);
        await queryRunner.query(`DROP INDEX "public"."IDX_980a19e1db3caa55d366a4e216"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_35e8277da52a915513e3ece8cf"`);
        await queryRunner.query(`DROP TABLE "schools"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6ae87d5ad4424e163c56480126"`);
        await queryRunner.query(`DROP TABLE "school_domains"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f6d54f95c31b73fb1bdd8e91d0"`);
        await queryRunner.query(`DROP TABLE "roles"`);
    }

}
