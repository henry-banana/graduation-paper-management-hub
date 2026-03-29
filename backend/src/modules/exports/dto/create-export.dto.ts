import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateExportDto {
  @ApiPropertyOptional({ example: 'period_2025_1' })
  @IsString()
  @IsOptional()
  periodId?: string;
}

export class CreateRubricExportDto {
  @ApiProperty({
    description: 'Score ID used to generate rubric export',
    example: 'sc_1',
  })
  @IsString()
  @IsNotEmpty()
  scoreId!: string;
}

export class CreateRubricExportResponseDto {
  @ApiProperty({
    description: 'Created export id',
    example: 'ex_1',
  })
  exportId!: string;

  @ApiProperty({
    description: 'Google Drive file id',
    example: 'drv_abc',
  })
  driveFileId!: string;
}

export class ExportDownloadResponseDto {
  @ApiProperty({
    description: 'Drive link for download',
    example: 'https://drive.google.com/file/d/drv_abc/view',
  })
  driveLink!: string;
}
