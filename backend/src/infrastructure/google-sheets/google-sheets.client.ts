import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, sheets_v4 } from 'googleapis';
import { JWT } from 'google-auth-library';

export interface SheetRange {
  spreadsheetId: string;
  range: string;
}

export interface SheetRow {
  values: unknown[];
  rowIndex: number;
}

@Injectable()
export class GoogleSheetsClient implements OnModuleInit {
  private readonly logger = new Logger(GoogleSheetsClient.name);
  private sheets!: sheets_v4.Sheets;
  private auth!: JWT;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.initializeClient();
  }

  private async initializeClient(): Promise<void> {
    const credentials = this.configService.get<string>('GOOGLE_SERVICE_ACCOUNT_JSON');
    
    if (!credentials) {
      this.logger.warn('GOOGLE_SERVICE_ACCOUNT_JSON not configured. Sheets client disabled.');
      return;
    }

    try {
      const serviceAccount = JSON.parse(credentials);
      this.auth = new google.auth.JWT(
        serviceAccount.client_email,
        undefined,
        serviceAccount.private_key,
        ['https://www.googleapis.com/auth/spreadsheets'],
      );

      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      this.logger.log('Google Sheets client initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Google Sheets client', error);
      throw error;
    }
  }

  async getRows(range: SheetRange): Promise<SheetRow[]> {
    if (!this.sheets) {
      throw new Error('Google Sheets client not initialized');
    }

    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: range.spreadsheetId,
      range: range.range,
    });

    const rows = response.data.values ?? [];
    return rows.map((values, index) => ({
      values,
      rowIndex: index,
    }));
  }

  async appendRow(range: SheetRange, values: unknown[]): Promise<void> {
    if (!this.sheets) {
      throw new Error('Google Sheets client not initialized');
    }

    await this.sheets.spreadsheets.values.append({
      spreadsheetId: range.spreadsheetId,
      range: range.range,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [values] },
    });
  }

  async updateRow(range: SheetRange, values: unknown[]): Promise<void> {
    if (!this.sheets) {
      throw new Error('Google Sheets client not initialized');
    }

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: range.spreadsheetId,
      range: range.range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [values] },
    });
  }

  async batchUpdate(
    spreadsheetId: string,
    updates: { range: string; values: unknown[][] }[],
  ): Promise<void> {
    if (!this.sheets) {
      throw new Error('Google Sheets client not initialized');
    }

    await this.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: updates.map((u) => ({
          range: u.range,
          values: u.values,
        })),
      },
    });
  }

  async healthCheck(): Promise<boolean> {
    if (!this.sheets) return false;
    
    try {
      const testSheetId = this.configService.get<string>('GOOGLE_SHEETS_ID');
      if (!testSheetId) return true; // No sheet configured, assume healthy
      
      await this.sheets.spreadsheets.get({
        spreadsheetId: testSheetId,
        fields: 'spreadsheetId',
      });
      return true;
    } catch {
      return false;
    }
  }
}
