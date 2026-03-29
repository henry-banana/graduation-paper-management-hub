import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, drive_v3 } from 'googleapis';
import { JWT, OAuth2Client } from 'google-auth-library';
import { Readable } from 'stream';
import { createHash } from 'crypto';

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

export interface DocxPdfUploadResult {
  editableDocFileId: string;
  editableDocLink: string;
  pdfFileId: string;
  pdfLink: string;
}

@Injectable()
export class GoogleDriveClient implements OnModuleInit {
  private readonly logger = new Logger(GoogleDriveClient.name);
  private drive!: drive_v3.Drive;
  private auth!: JWT | OAuth2Client;
  private initialized = false;
  private readonly userFolderCache = new Map<string, string>();

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.initializeClient();
  }

  private async initializeClient(): Promise<void> {
    const driveAuthMode =
      this.configService
        .get<string>('GOOGLE_DRIVE_AUTH_MODE', 'auto')
        .trim()
        .toLowerCase();
    const oauthRefreshToken =
      this.configService.get<string>('GOOGLE_OAUTH_REFRESH_TOKEN') ??
      this.configService.get<string>('GOOGLE_DRIVE_REFRESH_TOKEN');

    if (driveAuthMode !== 'service_account' && oauthRefreshToken) {
      const oauthClientId =
        this.configService.get<string>('GOOGLE_OAUTH_CLIENT_ID') ??
        this.configService.get<string>('GOOGLE_CLIENT_ID');
      const oauthClientSecret =
        this.configService.get<string>('GOOGLE_OAUTH_CLIENT_SECRET') ??
        this.configService.get<string>('GOOGLE_CLIENT_SECRET');

      if (!oauthClientId || !oauthClientSecret) {
        this.logger.warn(
          'GOOGLE_OAUTH_REFRESH_TOKEN is configured but OAuth client credentials are missing. Drive OAuth mode is unavailable.',
        );
      } else {
        try {
          const oauthClient = new google.auth.OAuth2(
            oauthClientId,
            oauthClientSecret,
          );
          oauthClient.setCredentials({
            refresh_token: oauthRefreshToken,
          });

          // Force token fetch on startup so misconfiguration fails fast.
          await oauthClient.getAccessToken();

          this.auth = oauthClient;
          this.drive = google.drive({ version: 'v3', auth: oauthClient });
          this.initialized = true;
          this.logger.log(
            'Google Drive client initialized with OAuth user credentials',
          );
          return;
        } catch (error) {
          this.logger.error(
            'Failed to initialize Google Drive OAuth user client',
            error,
          );

          if (driveAuthMode === 'oauth_user') {
            throw error;
          }
        }
      }
    }

    const email = this.configService.get<string>('GOOGLE_SERVICE_ACCOUNT_EMAIL');
    const rawKey = this.configService.get<string>('GOOGLE_PRIVATE_KEY');

    if (!email || !rawKey) {
      this.logger.warn(
        'Google Drive client disabled. Configure OAuth user credentials (GOOGLE_OAUTH_REFRESH_TOKEN + client id/secret) or service account credentials.',
      );
      return;
    }

    if (driveAuthMode === 'oauth_user') {
      this.logger.warn(
        'GOOGLE_DRIVE_AUTH_MODE=oauth_user but OAuth credentials are incomplete. Drive client disabled.',
      );
      return;
    }

    try {
      const privateKey = rawKey.replace(/\\n/g, '\n');

      this.auth = new google.auth.JWT(email, undefined, privateKey, [
        'https://www.googleapis.com/auth/drive.file',
      ]);

      this.drive = google.drive({ version: 'v3', auth: this.auth });
      this.initialized = true;
      this.logger.log(
        'Google Drive client initialized with service account credentials',
      );
    } catch (error) {
      this.logger.error('Failed to initialize Google Drive client', error);
      throw error;
    }
  }

  isReady(): boolean {
    return this.initialized;
  }

  get driveFolderId(): string {
    return this.configService.get<string>('GOOGLE_DRIVE_FOLDER_ID') ?? '';
  }

  async getOrCreateUserUploadFolderId(userId: string): Promise<string> {
    this.assertReady();

    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      throw new Error('userId is required to resolve upload folder');
    }

    const cachedFolderId = this.userFolderCache.get(normalizedUserId);
    if (cachedFolderId) {
      return cachedFolderId;
    }

    const folderName = this.buildUserFolderName(normalizedUserId);
    const parentFolderId = this.driveFolderId.trim();
    const queryParts = [
      `name='${this.escapeDriveQueryLiteral(folderName)}'`,
      "mimeType='application/vnd.google-apps.folder'",
      'trashed=false',
    ];

    if (parentFolderId) {
      queryParts.push(`'${this.escapeDriveQueryLiteral(parentFolderId)}' in parents`);
    }

    const existingFolderResponse = await this.drive.files.list({
      q: queryParts.join(' and '),
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      spaces: 'drive',
      pageSize: 1,
      fields: 'files(id,name)',
    });

    const existingFolderId = existingFolderResponse.data.files?.[0]?.id;
    if (existingFolderId) {
      this.userFolderCache.set(normalizedUserId, existingFolderId);
      return existingFolderId;
    }

    const createFolderResponse = await this.drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentFolderId ? [parentFolderId] : [],
      },
      fields: 'id,name',
    });

    const createdFolderId = createFolderResponse.data.id;
    if (!createdFolderId) {
      throw new Error(
        `Unable to create Google Drive folder for userId=${normalizedUserId}`,
      );
    }

    this.userFolderCache.set(normalizedUserId, createdFolderId);
    this.logger.log(
      `Created Google Drive folder for uploads userId=${normalizedUserId} folderName=${folderName} folderId=${createdFolderId}`,
    );

    return createdFolderId;
  }

  async uploadFile(
    fileName: string,
    mimeType: string,
    content: Buffer | Readable,
    folderId?: string,
  ): Promise<UploadResult> {
    this.assertReady();
    const targetFolder = folderId ?? this.driveFolderId;

    const response = await this.drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: fileName,
        parents: targetFolder ? [targetFolder] : [],
      },
      media: {
        mimeType,
        body: content instanceof Buffer ? Readable.from(content) : content,
      },
      fields: 'id,webViewLink,webContentLink',
    });

    // Make the file publicly readable (so download link works)
    await this.drive.permissions.create({
      fileId: response.data.id!,
      supportsAllDrives: true,
      requestBody: { role: 'reader', type: 'anyone' },
    });

    return {
      fileId: response.data.id!,
      webViewLink: response.data.webViewLink!,
      webContentLink: response.data.webContentLink ?? undefined,
    };
  }

  async uploadDocxAsEditableGoogleDoc(
    fileName: string,
    content: Buffer | Readable,
    folderId?: string,
  ): Promise<UploadResult> {
    this.assertReady();
    const targetFolder = folderId ?? this.driveFolderId;

    const response = await this.drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: fileName,
        mimeType: 'application/vnd.google-apps.document',
        parents: targetFolder ? [targetFolder] : [],
      },
      media: {
        mimeType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        body: content instanceof Buffer ? Readable.from(content) : content,
      },
      fields: 'id,webViewLink,webContentLink',
    });

    await this.drive.permissions.create({
      fileId: response.data.id!,
      supportsAllDrives: true,
      requestBody: { role: 'reader', type: 'anyone' },
    });

    return {
      fileId: response.data.id!,
      webViewLink: response.data.webViewLink!,
      webContentLink: response.data.webContentLink ?? undefined,
    };
  }

  async exportGoogleDocAsPdf(fileId: string): Promise<Buffer> {
    this.assertReady();

    const response = await this.drive.files.export(
      {
        fileId,
        mimeType: 'application/pdf',
      },
      {
        responseType: 'arraybuffer',
      },
    );

    return Buffer.from(response.data as ArrayBuffer);
  }

  async uploadDocxAndExportPdf(
    fileName: string,
    content: Buffer,
    folderId?: string,
  ): Promise<DocxPdfUploadResult> {
    this.assertReady();

    const editableDoc = await this.uploadDocxAsEditableGoogleDoc(
      fileName,
      content,
      folderId,
    );

    const pdfBuffer = await this.exportGoogleDocAsPdf(editableDoc.fileId);
    const pdfFileName = fileName.toLowerCase().endsWith('.docx')
      ? `${fileName.slice(0, -5)}.pdf`
      : `${fileName}.pdf`;

    const pdfUpload = await this.uploadFile(
      pdfFileName,
      'application/pdf',
      pdfBuffer,
      folderId,
    );

    return {
      editableDocFileId: editableDoc.fileId,
      editableDocLink: editableDoc.webViewLink,
      pdfFileId: pdfUpload.fileId,
      pdfLink: pdfUpload.webViewLink,
    };
  }

  async getFileMetadata(fileId: string): Promise<FileMetadata> {
    this.assertReady();
    const response = await this.drive.files.get({
      fileId,
      supportsAllDrives: true,
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
    this.assertReady();
    const response = await this.drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'arraybuffer' },
    );
    return Buffer.from(response.data as ArrayBuffer);
  }

  async deleteFile(fileId: string): Promise<void> {
    this.assertReady();
    await this.drive.files.delete({ fileId, supportsAllDrives: true });
  }

  async healthCheck(): Promise<boolean> {
    if (!this.initialized) return false;
    try {
      await this.drive.about.get({ fields: 'user' });
      return true;
    } catch {
      return false;
    }
  }

  private assertReady(): void {
    if (!this.initialized) {
      throw new Error(
        'Google Drive client is not initialized. Check GOOGLE_OAUTH_REFRESH_TOKEN + OAuth client credentials or GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY.',
      );
    }
  }

  private buildUserFolderName(userId: string): string {
    const sanitized = userId
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
      .replace(/\s+/g, ' ')
      .trim();
    const normalized = sanitized || 'unknown-user';

    const maxFolderNameLength = 48;
    if (normalized.length <= maxFolderNameLength) {
      return normalized;
    }

    const hash = createHash('sha1').update(normalized).digest('hex').slice(0, 8);
    const prefix = normalized.slice(0, maxFolderNameLength - hash.length - 1);
    return `${prefix}_${hash}`;
  }

  private escapeDriveQueryLiteral(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }
}
