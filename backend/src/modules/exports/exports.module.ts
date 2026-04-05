import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ExportsService } from './exports.service';
import { ExportsController } from './exports.controller';
import { RubricGeneratorService } from './rubric-generator/rubric-generator.service';
import { MinutesGeneratorService } from './minutes-generator/minutes-generator.service';
import { PdfConverterService } from './pdf-converter/pdf-converter.service';

@Module({
  imports: [ConfigModule],
  controllers: [ExportsController],
  providers: [
    ExportsService,
    RubricGeneratorService,
    MinutesGeneratorService,
    PdfConverterService,
  ],
  exports: [ExportsService, MinutesGeneratorService],
})
export class ExportsModule {}


