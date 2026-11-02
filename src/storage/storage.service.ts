import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Ce type est nécessaire pour que TypeScript reconnaisse Express.Multer.File
import 'multer'; 

@Injectable()
export class StorageService {
  private bucketName: string;

  constructor(
    @Inject('S3_CLIENT') private readonly s3Client: S3Client,
    private readonly configService: ConfigService,
  ) {
    this.bucketName = this.configService.get<string>('AWS_BUCKET_NAME')!;
  }

  async uploadFile(file: Express.Multer.File, folder: string = 'documents') {
    const key = `${folder}/${Date.now()}-${file.originalname}`;
    
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    try {
      await this.s3Client.send(command);
      return key; // On retourne le chemin pour le stocker dans la base de données
    } catch (error) {
      // Correction ici : on vérifie que l'erreur est bien une instance d'Error
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      throw new BadRequestException(`Erreur lors de l'upload : ${message}`);
    }
  }

  async getFileUrl(key: string) {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });
    return getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
  }
}