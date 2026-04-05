import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty } from 'class-validator';
import { FileType, SUBMISSION_FILE_TYPES } from '../submission.constants';

export class CreateSubmissionDto {
  @ApiProperty({
    description: 'Type of file being submitted',
    enum: SUBMISSION_FILE_TYPES,
    example: 'REPORT',
  })
  @IsIn([...SUBMISSION_FILE_TYPES], {
    message:
      'fileType must be one of: REPORT, TURNITIN, REVISION, REVISION_EXPLANATION, INTERNSHIP_CONFIRMATION',
  })
  @IsNotEmpty()
  fileType!: FileType;

  // Note: The actual file will be handled separately via multipart/form-data
  // This DTO represents the JSON body portion of the request
}
