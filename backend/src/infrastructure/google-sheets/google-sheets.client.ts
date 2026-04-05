import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
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
  private readonly rowsCacheTtlMs = 5000;
  private readonly headersCacheTtlMs = 5000;
  // In-flight deduplication: concurrent reads for the same sheet share one GS call.
  private readonly rowsInFlight = new Map<string, Promise<SheetRow[]>>();
  private readonly headersInFlight = new Map<string, Promise<string[]>>();
  private readonly rowsCache = new Map<
    string,
    { value: SheetRow[]; expiresAt: number }
  >();
  private readonly headersCache = new Map<
    string,
    { value: string[]; expiresAt: number }
  >();

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

    const cachedRows = this.getCachedRows(sheetName);
    if (cachedRows) {
      return cachedRows;
    }

    const inFlight = this.rowsInFlight.get(sheetName);
    if (inFlight) {
      return this.cloneSheetRows(await inFlight);
    }

    const task = this.executeSheetsCall('getRows', async () => {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A2:ZZ`,
        valueRenderOption: 'UNFORMATTED_VALUE',
      });

      const rows = (response.data.values ?? []) as string[][];
      return rows
        .map((values, index) => ({
          values: values.map((v) => (v == null ? '' : String(v))),
          rowIndex: index,
          sheetRowNumber: index + 2,
        }))
        .filter((r) => r.values.some((v) => v !== ''));
    });

    this.rowsInFlight.set(sheetName, task);
    try {
      const rows = await task;
      this.rowsCache.set(sheetName, {
        value: this.cloneSheetRows(rows),
        expiresAt: Date.now() + this.rowsCacheTtlMs,
      });
      return this.cloneSheetRows(rows);
    } finally {
      this.rowsInFlight.delete(sheetName);
    }
  }

  /**
   * Append a new row at the end of a sheet
   */
  async appendRow(sheetName: string, values: (string | number | boolean | null)[]): Promise<void> {
    this.assertReady();
    await this.executeSheetsCall('appendRow', () =>
      this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [values] },
      }),
    );
    this.invalidateSheetCaches(sheetName, { rows: true, headers: false });
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
    await this.executeSheetsCall('updateRow', () =>
      this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A${sheetRowNumber}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [values] },
      }),
    );
    this.invalidateSheetCaches(sheetName, { rows: true, headers: false });
  }

  /**
   * Batch update multiple ranges at once
   */
  async batchUpdate(
    updates: { range: string; values: (string | number | boolean | null)[][] }[],
  ): Promise<void> {
    this.assertReady();
    await this.executeSheetsCall('batchUpdate', () =>
      this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: updates.map((u) => ({ range: u.range, values: u.values })),
        },
      }),
    );

    const affectedSheets = new Set<string>();
    for (const update of updates) {
      const sheetName = this.extractSheetNameFromRange(update.range);
      if (sheetName) {
        affectedSheets.add(sheetName);
      }
    }

    if (affectedSheets.size === 0) {
      this.invalidateAllCaches({ rows: true, headers: true });
      return;
    }

    for (const sheetName of affectedSheets) {
      this.invalidateSheetCaches(sheetName, { rows: true, headers: true });
    }
  }

  /**
   * Clear (soft-delete) a row by overwriting with empty values
   * We use a DELETED marker in col A to logically delete
   */
  async markRowDeleted(sheetName: string, sheetRowNumber: number): Promise<void> {
    this.assertReady();
    await this.executeSheetsCall('markRowDeleted', () =>
      this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A${sheetRowNumber}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['__DELETED__']] },
      }),
    );
    this.invalidateSheetCaches(sheetName, { rows: true, headers: false });
  }

  async healthCheck(): Promise<boolean> {
    if (!this.initialized) return false;
    try {
      await this.executeSheetsCall('healthCheck', () =>
        this.sheets.spreadsheets.get({
          spreadsheetId: this.spreadsheetId,
          fields: 'spreadsheetId',
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async ensureSheet(sheetName: string, headers: string[]): Promise<void> {
    this.assertReady();

    const spreadsheet = await this.executeSheetsCall('ensureSheet.getSpreadsheet', () =>
      this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      }),
    );

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
    await this.executeSheetsCall('ensureSheet.updateHeader', () =>
      this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A1:${endColumn}1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [headers] },
      }),
    );

    this.invalidateSheetCaches(sheetName, { rows: true, headers: true });
  }

  async ensureSheets(definitions: SheetDefinition[]): Promise<void> {
    for (const def of definitions) {
      await this.ensureSheet(def.sheetName, def.headers);
    }
  }

  async getHeaderRow(sheetName: string): Promise<string[]> {
    this.assertReady();

    const cachedHeader = this.getCachedHeader(sheetName);
    if (cachedHeader) {
      return cachedHeader;
    }

    const inFlight = this.headersInFlight.get(sheetName);
    if (inFlight) {
      return [...(await inFlight)];
    }

    const task = this.executeSheetsCall('getHeaderRow', async () => {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A1:ZZ1`,
        valueRenderOption: 'UNFORMATTED_VALUE',
      });

      const header = (response.data.values?.[0] ?? []) as unknown[];
      return header.map((value) => (value == null ? '' : String(value)));
    });

    this.headersInFlight.set(sheetName, task);
    try {
      const header = await task;
      this.headersCache.set(sheetName, {
        value: [...header],
        expiresAt: Date.now() + this.headersCacheTtlMs,
      });
      return [...header];
    } finally {
      this.headersInFlight.delete(sheetName);
    }
  }

  async clearDataRows(sheetName: string): Promise<void> {
    this.assertReady();
    await this.executeSheetsCall('clearDataRows', () =>
      this.sheets.spreadsheets.values.clear({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A2:ZZ`,
      }),
    );
    this.invalidateSheetCaches(sheetName, { rows: true, headers: false });
  }

  private getCachedRows(sheetName: string): SheetRow[] | null {
    const cached = this.rowsCache.get(sheetName);
    if (!cached) return null;

    if (cached.expiresAt <= Date.now()) {
      this.rowsCache.delete(sheetName);
      return null;
    }

    return this.cloneSheetRows(cached.value);
  }

  private getCachedHeader(sheetName: string): string[] | null {
    const cached = this.headersCache.get(sheetName);
    if (!cached) return null;

    if (cached.expiresAt <= Date.now()) {
      this.headersCache.delete(sheetName);
      return null;
    }

    return [...cached.value];
  }

  private invalidateSheetCaches(
    sheetName: string,
    options: { rows?: boolean; headers?: boolean },
  ): void {
    if (options.rows) {
      this.rowsCache.delete(sheetName);
    }
    if (options.headers) {
      this.headersCache.delete(sheetName);
    }
  }

  private invalidateAllCaches(options: { rows?: boolean; headers?: boolean }): void {
    if (options.rows) {
      this.rowsCache.clear();
    }
    if (options.headers) {
      this.headersCache.clear();
    }
  }

  private extractSheetNameFromRange(range: string): string | null {
    const bangIndex = range.indexOf('!');
    if (bangIndex <= 0) {
      return null;
    }

    const rawSheetName = range.slice(0, bangIndex).trim();
    if (!rawSheetName) {
      return null;
    }

    if (
      rawSheetName.startsWith("'") &&
      rawSheetName.endsWith("'") &&
      rawSheetName.length > 1
    ) {
      return rawSheetName.slice(1, -1);
    }

    return rawSheetName;
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

  private cloneSheetRows(rows: SheetRow[]): SheetRow[] {
    return rows.map((row) => ({
      ...row,
      values: [...row.values],
    }));
  }

  private async executeSheetsCall<T>(operation: string, callback: () => Promise<T>): Promise<T> {
    const MAX_RETRIES = 5;
    const BASE_DELAY_MS = 2000;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await callback();
      } catch (error) {
        const statusCode = this.extractStatusCode(error);
        const message = this.extractErrorMessage(error);
        const isQuotaError =
          statusCode === HttpStatus.TOO_MANY_REQUESTS ||
          /quota\s+exceeded|rate\s+limit|too\s+many\s+requests/i.test(message);

        if (isQuotaError && attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt);
          this.logger.warn(
            `Google Sheets quota hit during ${operation} (attempt ${attempt + 1}/${MAX_RETRIES}). Retrying in ${delay}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        this.rethrowAsHttpException(operation, error);
        throw error;
      }
    }

    // TypeScript requires a return statement (unreachable)
    throw new Error(`Unreachable: executeSheetsCall ${operation}`);
  }

  private rethrowAsHttpException(operation: string, error: unknown): never {
    const statusCode = this.extractStatusCode(error);
    const message = this.extractErrorMessage(error);

    if (
      statusCode === HttpStatus.TOO_MANY_REQUESTS ||
      /quota\s+exceeded|rate\s+limit|too\s+many\s+requests/i.test(message)
    ) {
      this.logger.warn(
        `Google Sheets quota throttled during ${operation}. Returning HTTP 429 to caller.`,
      );
      throw new HttpException(
        'Google Sheets quota exceeded. Please retry shortly.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (typeof statusCode === 'number' && statusCode >= 500) {
      this.logger.error(
        `Google Sheets upstream error during ${operation}: ${message}`,
      );
      throw new HttpException(
        'Google Sheets service temporarily unavailable. Please retry shortly.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    throw error;
  }

  private extractStatusCode(error: unknown): number | undefined {
    if (!error || typeof error !== 'object') {
      return undefined;
    }

    const candidate = error as {
      code?: number | string;
      status?: number;
      response?: { status?: number };
    };

    if (typeof candidate.status === 'number') {
      return candidate.status;
    }

    if (typeof candidate.response?.status === 'number') {
      return candidate.response.status;
    }

    if (typeof candidate.code === 'number') {
      return candidate.code;
    }

    if (typeof candidate.code === 'string') {
      const parsed = Number(candidate.code);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return undefined;
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (!error || typeof error !== 'object') {
      return String(error);
    }

    const candidate = error as { message?: unknown; errors?: Array<{ message?: string }> };
    if (typeof candidate.message === 'string' && candidate.message.length > 0) {
      return candidate.message;
    }

    const nested = candidate.errors?.map((item) => item.message).filter(Boolean).join('; ');
    if (nested) {
      return nested;
    }

    return String(error);
  }
}
