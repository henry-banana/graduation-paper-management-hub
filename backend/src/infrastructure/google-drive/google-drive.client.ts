import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, drive_v3 } from 'googleapis';
import { JWT } from 'google-auth-library';
import { Readable } from 'stream';

export interface UploadResult {
  fileId: string;
  webViewLink: string;
  webContentLink?: string;
}

export interface FileMetadata {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  webViewLink?: string;
}

@Injectable()
export class GoogleDriveClient implements OnModuleInit {
  private readonly logger = new Logger(GoogleDriveClient.name);
  private drive!: drive_v3.Drive;
  private auth!: JWT;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.initializeClient();
  }

  private async initializeClient(): Promise<void> {
    const credentials = this.configService.get<string>('GOOGLE_SERVICE_ACCOUNT_JSON');

    if (!credentials) {
      this.logger.warn('GOOGLE_SERVICE_ACCOUNT_JSON not configured. Drive client disabled.');
      return;
    }

    try {
      const serviceAccount = JSON.parse(credentials);
      this.auth = new google.auth.JWT(
        serviceAccount.client_email,
        undefined,
        serviceAccount.private_key,
        ['https://www.googleapis.com/auth/drive.file'],
      );

      this.drive = google.drive({ version: 'v3', auth: this.auth });
      this.logger.log('Google Drive client initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Google Drive client', error);
      throw error;
    }
  }

  async uploadFile(
    folderId: string,
    fileName: string,
    mimeType: string,
    content: Buffer | Readable,
  ): Promise<UploadResult> {
    if (!this.drive) {
      throw new Error('Google Drive client not initialized');
    }

    const response = await this.drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
      },
      media: {
        mimeType,
        body: content instanceof Buffer ? Readable.from(content) : content,
      },
      fields: 'id,webViewLink,webContentLink',
    });

    return {
      fileId: response.data.id!,
      webViewLink: response.data.webViewLink!,
      webContentLink: response.data.webContentLink ?? undefined,
    };
  }

  async getFileMetadata(fileId: string): Promise<FileMetadata> {
    if (!this.drive) {
      throw new Error('Google Drive client not initialized');
    }

    const response = await this.drive.files.get({
      fileId,
      fields: 'id,name,mimeType,size,createdTime,modifiedTime,webViewLink',
    });

    return {
      id: response.data.id!,
      name: response.data.name!,
      mimeType: response.data.mimeType!,
      size: response.data.size ?? undefined,
      createdTime: response.data.createdTime ?? undefined,
      modifiedTime: response.data.modifiedTime ?? undefined,
      webViewLink: response.data.webViewLink ?? undefined,
    };
  }

  async downloadFile(fileId: string): Promise<Buffer> {
    if (!this.drive) {
      throw new Error('Google Drive client not initialized');
    }

    const response = await this.drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' },
    );

    return Buffer.from(response.data as ArrayBuffer);
  }

  async deleteFile(fileId: string): Promise<void> {
    if (!this.drive) {
      throw new Error('Google Drive client not initialized');
    }

    await this.drive.files.delete({ fileId });
  }

  async healthCheck(): Promise<boolean> {
    if (!this.drive) return false;

    try {
      await this.drive.about.get({ fields: 'user' });
      return true;
    } catch {
      return false;
    }
  }
}
