export const SUBMISSION_FILE_TYPES = ['REPORT', 'TURNITIN', 'REVISION'] as const;

export type FileType = (typeof SUBMISSION_FILE_TYPES)[number];

export const PDF_MIME_TYPE = 'application/pdf';
export const MAX_SUBMISSION_FILE_SIZE = 50 * 1024 * 1024; // 50MB