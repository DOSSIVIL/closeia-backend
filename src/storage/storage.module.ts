import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { StorageService } from './storage.service';

@Module({
  providers: [
    {
      provide: 'S3_CLIENT',
      useFactory: (configService: ConfigService) => {
        return new S3Client({
          region: configService.get<string>('AWS_REGION'),
          endpoint: configService.get<string>('AWS_ENDPOINT_URL_S3'),
          credentials: {
            accessKeyId: configService.get<string>('AWS_ACCESS_KEY_ID')!,
            secretAccessKey: configService.get<string>('AWS_SECRET_ACCESS_KEY')!,
          },
          forcePathStyle: true, // Requis pour Neon Object Storage
        });
      },
      inject: [ConfigService],
    },
    StorageService,
  ],
  exports: ['S3_CLIENT', StorageService],
})
export class StorageModule {}