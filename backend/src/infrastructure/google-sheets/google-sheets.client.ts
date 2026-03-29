import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, sheets_v4 } from 'googleapis';
import { JWT } from 'google-auth-library';

export interface SheetRange {
  spreadsheetId: string;
  range: string;
}

export interface SheetRow {
  values: string[];
  rowIndex: number; // 0-based index in the returned rows (excludes header)
  sheetRowNumber: number; // actual 1-based row in sheet (header is row 1, data starts at row 2)
}

export interface SheetDefinition {
  sheetName: string;
  headers: string[];
}

@Injectable()
export class GoogleSheetsClient implements OnModuleInit {
  private readonly logger = new Logger(GoogleSheetsClient.name);
  private sheets!: sheets_v4.Sheets;
  private auth!: JWT;
  private initialized = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.initializeClient();
  }

  private async initializeClient(): Promise<void> {
    const email = this.configService.get<string>('GOOGLE_SERVICE_ACCOUNT_EMAIL');
    const rawKey = this.configService.get<string>('GOOGLE_PRIVATE_KEY');

    if (!email || !rawKey) {
      this.logger.warn(
        'GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY not configured. Sheets client disabled.',
      );
      return;
    }

    try {
      // Handle escaped newlines in private key from .env
      const privateKey = rawKey.replace(/\\n/g, '\n');

      this.auth = new google.auth.JWT(email, undefined, privateKey, [
        'https://www.googleapis.com/auth/spreadsheets',
      ]);

      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      this.initialized = true;
      this.logger.log('Google Sheets client initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Google Sheets client', error);
      throw error;
    }
  }

  isReady(): boolean {
    return this.initialized;
  }

  get spreadsheetId(): string {
    const id = this.configService.get<string>('GOOGLE_SPREADSHEET_ID');
    if (!id) throw new Error('GOOGLE_SPREADSHEET_ID not configured');
    return id;
  }

  /**
   * Read all rows from a sheet range (returns string arrays, skips header row)
   */
  async getRows(sheetName: string): Promise<SheetRow[]> {
    this.assertReady();
    const range = `${sheetName}!A2:ZZ`;
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });

    const rows = (response.data.values ?? []) as string[][];
    return rows
      .map((values, index) => ({
        values: values.map((v) => (v == null ? '' : String(v))),
        rowIndex: index,
        sheetRowNumber: index + 2, // header is row 1, data from row 2
      }))
      .filter((r) => r.values.some((v) => v !== '')); // skip blank rows
  }

  /**
   * Append a new row at the end of a sheet
   */
  async appendRow(sheetName: string, values: (string | number | boolean | null)[]): Promise<void> {
    this.assertReady();
    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [values] },
    });
  }

  /**
   * Update a specific row by its 1-based sheet row number
   */
  async updateRow(
    sheetName: string,
    sheetRowNumber: number,
    values: (string | number | boolean | null)[],
  ): Promise<void> {
    this.assertReady();
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${sheetName}!A${sheetRowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [values] },
    });
  }

  /**
   * Batch update multiple ranges at once
   */
  async batchUpdate(
    updates: { range: string; values: (string | number | boolean | null)[][] }[],
  ): Promise<void> {
    this.assertReady();
    await this.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: updates.map((u) => ({ range: u.range, values: u.values })),
      },
    });
  }

  /**
   * Clear (soft-delete) a row by overwriting with empty values
   * We use a DELETED marker in col A to logically delete
   */
  async markRowDeleted(sheetName: string, sheetRowNumber: number): Promise<void> {
    this.assertReady();
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${sheetName}!A${sheetRowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [['__DELETED__']] },
    });
  }

  async healthCheck(): Promise<boolean> {
    if (!this.initialized) return false;
    try {
      await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
        fields: 'spreadsheetId',
      });
      return true;
    } catch {
      return false;
    }
  }

  async ensureSheet(sheetName: string, headers: string[]): Promise<void> {
    this.assertReady();

    const spreadsheet = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
    });

    const existingTitles = (spreadsheet.data.sheets ?? [])
      .map((s) => s.properties?.title)
      .filter((title): title is string => Boolean(title));
    const normalizedSheetName = sheetName.trim().toLowerCase();
    const hasSheet = existingTitles.some(
      (title) => title.trim().toLowerCase() === normalizedSheetName,
    );

    if (!hasSheet) {
      try {
        await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId: this.spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: { title: sheetName },
                },
              },
            ],
          },
        });
        this.logger.log(`Created missing sheet tab: ${sheetName}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes('already exists')) {
          throw error;
        }

        this.logger.warn(
          `Sheet tab ${sheetName} already exists. Continue with header sync.`,
        );
      }
    }

    const endColumn = this.columnNumberToName(headers.length);
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${sheetName}!A1:${endColumn}1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [headers] },
    });
  }

  async ensureSheets(definitions: SheetDefinition[]): Promise<void> {
    for (const def of definitions) {
      await this.ensureSheet(def.sheetName, def.headers);
    }
  }

  private columnNumberToName(columnNumber: number): string {
    let dividend = columnNumber;
    let columnName = '';

    while (dividend > 0) {
      const modulo = (dividend - 1) % 26;
      columnName = String.fromCharCode(65 + modulo) + columnName;
      dividend = Math.floor((dividend - modulo) / 26);
    }

    return columnName || 'A';
  }

  private assertReady(): void {
    if (!this.initialized) {
      throw new Error(
        'Google Sheets client is not initialized. Check GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY env vars.',
      );
    }
  }
}
