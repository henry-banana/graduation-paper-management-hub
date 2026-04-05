export const KLTN_RUBRIC_EXPORT_ROLES = ['GVHD', 'GVPB', 'TV_HD', 'CT_HD', 'TK_HD'] as const;

export type KltnRubricExportRole = (typeof KLTN_RUBRIC_EXPORT_ROLES)[number];

export const EXPORT_DOCX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const EXPORT_PDF_MIME_TYPE = 'application/pdf';

export const EXPORT_JSON_MIME_TYPE = 'application/json';

export const EXPORT_DEFAULT_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';