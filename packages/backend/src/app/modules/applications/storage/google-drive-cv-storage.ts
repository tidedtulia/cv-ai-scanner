import { CvStorage, CvUpload, StoredCv } from './cv-storage';
import { AccessToken, OAuthClient, deleteFile, refreshAccessToken, uploadFile } from './google-drive.client';

export interface GoogleDriveConfig extends OAuthClient {
  refreshToken: string;
  /** Id of cv-ai-scanner/cv, printed by `npm run drive:auth` */
  folderId: string;
}

/** Renew the access token a minute before Google expires it. */
const TOKEN_EXPIRY_MARGIN_MS = 60_000;

/** CVs in the Google Drive of a regular account (CV_STORAGE=google-drive). */
export class GoogleDriveCvStorage extends CvStorage {
  private token?: AccessToken;

  constructor(private readonly config: GoogleDriveConfig) {
    super();
  }

  async upload(file: CvUpload): Promise<StoredCv> {
    const { id, webViewLink } = await uploadFile(await this.accessToken(), {
      name: file.fileName,
      folderId: this.config.folderId,
      mimeType: file.mimeType,
      content: file.content,
    });
    return { fileId: id, url: webViewLink };
  }

  async remove(fileId: string): Promise<void> {
    await deleteFile(await this.accessToken(), fileId);
  }

  private async accessToken(): Promise<string> {
    if (!this.token || this.token.expiresAt - TOKEN_EXPIRY_MARGIN_MS <= Date.now()) {
      this.token = await refreshAccessToken(this.config, this.config.refreshToken);
    }
    return this.token.accessToken;
  }
}
