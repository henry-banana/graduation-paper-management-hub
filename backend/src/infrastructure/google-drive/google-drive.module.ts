import { Module, Global } from '@nestjs/common';
import { GoogleDriveClient } from './google-drive.client';

@Global()
@Module({
  providers: [GoogleDriveClient],
  exports: [GoogleDriveClient],
})
export class GoogleDriveModule {}
