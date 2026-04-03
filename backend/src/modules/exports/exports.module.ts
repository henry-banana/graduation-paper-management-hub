import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ExportsService } from './exports.service';
import { ExportsController } from './exports.controller';
import { RubricGeneratorService } from './rubric-generator/rubric-generator.service';
import { MinutesGeneratorService } from './minutes-generator/minutes-generator.service';

@Module({
  imports: [ConfigModule],
  controllers: [ExportsController],
  providers: [ExportsService, RubricGeneratorService, MinutesGeneratorService],
  exports: [ExportsService, MinutesGeneratorService],
})
export class ExportsModule {}


