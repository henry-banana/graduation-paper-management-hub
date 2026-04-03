export const SUBMISSION_FILE_TYPES = ['REPORT', 'TURNITIN', 'REVISION', 'INTERNSHIP_CONFIRMATION'] as const;

export const SUBMISSION_STATUSES = ['DRAFT', 'CONFIRMED', 'LOCKED'] as const;
export const SUBMISSION_VERSION_LABEL_PATTERN = /^V\d+$/;

export const SUBMISSION_POLICY_ERROR_CODES = {
	OVERDUE_SUBMISSION_LOCKED: 'OVERDUE_SUBMISSION_LOCKED',
	REVISION_ROUND_NOT_OPEN: 'REVISION_ROUND_NOT_OPEN',
	REVISION_ROUND_ALREADY_CLOSED: 'REVISION_ROUND_ALREADY_CLOSED',
	VERSION_IMMUTABLE_OUTSIDE_DEADLINE: 'VERSION_IMMUTABLE_OUTSIDE_DEADLINE',
} as const;

export type FileType = (typeof SUBMISSION_FILE_TYPES)[number];
export type VersionLabel = `V${number}`;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const PDF_MIME_TYPE = 'application/pdf';
export const MAX_SUBMISSION_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function buildVersionLabel(versionNumber: number): VersionLabel {
	const safeVersion = Number.isFinite(versionNumber) && versionNumber > 0
		? Math.floor(versionNumber)
		: 1;
	return `V${safeVersion}` as VersionLabel;
}