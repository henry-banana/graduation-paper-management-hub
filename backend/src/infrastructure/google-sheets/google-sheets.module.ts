import { Module, Global } from '@nestjs/common';
import { GoogleSheetsClient } from './google-sheets.client';

@Global()
@Module({
  providers: [GoogleSheetsClient],
  exports: [GoogleSheetsClient],
})
export class GoogleSheetsModule {}
