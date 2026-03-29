import { Module } from '@nestjs/common';
import { ExportsService } from './exports.service';
import { ExportsController } from './exports.controller';
import { RubricGeneratorService } from './rubric-generator/rubric-generator.service';

@Module({
  controllers: [ExportsController],
  providers: [ExportsService, RubricGeneratorService],
  exports: [ExportsService],
})
export class ExportsModule {}
