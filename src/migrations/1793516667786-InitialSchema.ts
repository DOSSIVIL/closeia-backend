import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1793516667786 implements MigrationInterface {
    name = 'InitialSchema1793516667786'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "school_domains" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "domain" character varying(190) NOT NULL, "schoolId" uuid NOT NULL, CONSTRAINT "CHK_22f0c7540c1099c87f5377e74a" CHECK (domain = LOWER(domain)), CONSTRAINT "PK_ba8569080d36b1771c4ead0b6f5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_6ae87d5ad4424e163c56480126" ON "school_domains" ("domain") `);
        await queryRunner.query(`CREATE TABLE "schools" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying(20) NOT NULL, "name" character varying(200) NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_95b932e47ac129dd8e23a0db548" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_35e8277da52a915513e3ece8cf" ON "schools" ("code") `);
        await queryRunner.query(`CREATE TABLE "roles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying(50) NOT NULL, "name" character varying(120) NOT NULL, "description" text, "isSystem" boolean NOT NULL DEFAULT false, "permissions" json NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f6d54f95c31b73fb1bdd8e91d0" ON "roles" ("code") `);
        await queryRunner.query(`INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES ($1, $2, $3, $4, $5, $6)`, ["neondb","public","role_assignments","GENERATED_COLUMN","schoolScope","COALESCE(\"schoolId\"::text, '')"]);
        await queryRunner.query(`CREATE TABLE "role_assignments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "roleId" uuid NOT NULL, "schoolId" uuid, "schoolScope" character varying(36) GENERATED ALWAYS AS (COALESCE("schoolId"::text, '')) STORED NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_fc2df9835ac1d2a34839f113783" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_assignment_scope" ON "role_assignments" ("userId", "roleId", "schoolScope") `);
        await queryRunner.query(`CREATE TYPE "public"."users_status_enum" AS ENUM('ACTIVE', 'SUSPENDED', 'INVITED')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(254) NOT NULL, "firstName" character varying(100) NOT NULL, "lastName" character varying(100) NOT NULL, "passwordHash" character varying(255), "googleSub" character varying(64), "avatarUrl" character varying(500), "status" "public"."users_status_enum" NOT NULL DEFAULT 'ACTIVE', "schoolId" uuid, "tokenVersion" integer NOT NULL DEFAULT '0', "failedLoginCount" integer NOT NULL DEFAULT '0', "lockedUntil" TIMESTAMP WITH TIME ZONE, "lastLoginAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_828e22a5dc543a68eb7d14b4e6" CHECK (email = LOWER(email)), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_980a19e1db3caa55d366a4e216" ON "users" ("googleSub") `);
        await queryRunner.query(`CREATE TABLE "auth_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "client" character varying(10) NOT NULL, "userAgent" character varying(255), "ip" character varying(64), "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "revokedAt" TIMESTAMP WITH TIME ZONE, "revokedReason" character varying(30), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_641507381f32580e8479efc36cd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_925b24d7fc2f9324ce972aee02" ON "auth_sessions" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4d5b325649caf1628a6e2e2be1" ON "auth_sessions" ("expiresAt") `);
        await queryRunner.query(`ALTER TABLE "school_domains" ADD CONSTRAINT "FK_0fff798a606f56611d6e0ccde2f" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "role_assignments" ADD CONSTRAINT "FK_4c31464b76da5895e211a5d2099" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "role_assignments" ADD CONSTRAINT "FK_6000ca1e3e8add1eb504f139a7b" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "role_assignments" ADD CONSTRAINT "FK_388639c3541970d8121aab111f0" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_435e192698a6b7d10849295643d" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "auth_sessions" ADD CONSTRAINT "FK_925b24d7fc2f9324ce972aee025" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "auth_sessions" DROP CONSTRAINT "FK_925b24d7fc2f9324ce972aee025"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_435e192698a6b7d10849295643d"`);
        await queryRunner.query(`ALTER TABLE "role_assignments" DROP CONSTRAINT "FK_388639c3541970d8121aab111f0"`);
        await queryRunner.query(`ALTER TABLE "role_assignments" DROP CONSTRAINT "FK_6000ca1e3e8add1eb504f139a7b"`);
        await queryRunner.query(`ALTER TABLE "role_assignments" DROP CONSTRAINT "FK_4c31464b76da5895e211a5d2099"`);
        await queryRunner.query(`ALTER TABLE "school_domains" DROP CONSTRAINT "FK_0fff798a606f56611d6e0ccde2f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4d5b325649caf1628a6e2e2be1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_925b24d7fc2f9324ce972aee02"`);
        await queryRunner.query(`DROP TABLE "auth_sessions"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_980a19e1db3caa55d366a4e216"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."uq_assignment_scope"`);
        await queryRunner.query(`DROP TABLE "role_assignments"`);
        await queryRunner.query(`DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "database" = $3 AND "schema" = $4 AND "table" = $5`, ["GENERATED_COLUMN","schoolScope","neondb","public","role_assignments"]);
        await queryRunner.query(`DROP INDEX "public"."IDX_f6d54f95c31b73fb1bdd8e91d0"`);
        await queryRunner.query(`DROP TABLE "roles"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_35e8277da52a915513e3ece8cf"`);
        await queryRunner.query(`DROP TABLE "schools"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6ae87d5ad4424e163c56480126"`);
        await queryRunner.query(`DROP TABLE "school_domains"`);
    }

}
