import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { RolesModule } from '../roles/roles.module';
import { UsersController } from './users.controller';
import { School } from '../schools/entities/school.entity';
import { SchoolDomain } from '../schools/entities/school-domain.entity';
import { WelcomeEmailService } from './welcome-email.service';
import { UserImportService } from './user-import.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, School, SchoolDomain]),
    RolesModule,
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const port = config.get<number>('SMTP_PORT', 587);
        return {
          transport: {
            host: config.get<string>('SMTP_HOST') ?? 'localhost',
            port,
            secure: port === 465,
            auth: {
              user: config.get<string>('SMTP_USER') ?? '',
              pass: config.get<string>('SMTP_PASSWORD') ?? '',
            },
          },
          defaults: {
            from:
              config.get<string>('SMTP_FROM') ?? 'CloseIA <no-reply@localhost>',
          },
        };
      },
    }),
  ],
  controllers: [UsersController],
  providers: [UsersService, WelcomeEmailService, UserImportService],
  exports: [UsersService],
})
export class UsersModule {}
