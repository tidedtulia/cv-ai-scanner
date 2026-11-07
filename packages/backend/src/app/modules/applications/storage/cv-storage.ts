export interface CvUpload {
  fileName: string;
  content: Buffer;
  mimeType: string;
}

export interface StoredCv {
  /** Saved as applications.cv_drive_file_id — n8n downloads the CV by this id */
  fileId: string;
  /** Saved as applications.cv_drive_url — the link HR opens */
  url: string;
}

/**
 * Where CV files live. Selected by CV_STORAGE (see cv-storage.provider.ts):
 * `google-drive` in real environments, `local` for dev / tests without Google credentials.
 * Abstract class (not an interface) so it can be used as the Nest injection token.
 */
export abstract class CvStorage {
  abstract upload(file: CvUpload): Promise<StoredCv>;
  abstract remove(fileId: string): Promise<void>;
  /** Content of a stored CV; null when the file no longer exists (HR view, hr-applications AC-5) */
  abstract download(fileId: string): Promise<Buffer | null>;
}
