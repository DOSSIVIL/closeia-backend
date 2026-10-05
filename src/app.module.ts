import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { SchoolsModule } from './modules/schools/schools.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { AuditModule } from './modules/audit/audit.module';
import { IngestionModule } from './modules/ingestion/ingestion.module';
import { RetrievalModule } from './modules/retrieval/retrieval.module';
import { SyncModule } from './modules/sync/sync.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [AuthModule, SchoolsModule, UsersModule, RolesModule, DocumentsModule, ConversationsModule, AuditModule, IngestionModule, RetrievalModule, SyncModule, DashboardModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
