import { resolve } from 'node:path';
import { Provider } from '@nestjs/common';
import { CvStorage } from './cv-storage';
import { GoogleDriveCvStorage } from './google-drive-cv-storage';
import { LocalCvStorage } from './local-cv-storage';

const GOOGLE_DRIVE_VARS = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REFRESH_TOKEN',
  'GOOGLE_DRIVE_CV_FOLDER_ID',
] as const;

const DEFAULT_LOCAL_DIR = 'tmp/cv-uploads';

/**
 * Picks the CV storage from CV_STORAGE. Runs when Nest boots, so a misconfigured
 * environment fails at startup instead of on the first submission (AC-5).
 */
export function createCvStorage(env: NodeJS.ProcessEnv = process.env): CvStorage {
  const kind = env['CV_STORAGE'];

  if (kind === 'local') {
    return new LocalCvStorage(resolve(env['CV_LOCAL_DIR'] || DEFAULT_LOCAL_DIR));
  }

  if (kind === 'google-drive') {
    const missing = GOOGLE_DRIVE_VARS.filter((name) => !env[name]);
    if (missing.length > 0) {
      throw new Error(
        `CV_STORAGE=google-drive requires ${missing.join(', ')} — see docs/features/submit-application-api/google-drive-setup.md`,
      );
    }
    return new GoogleDriveCvStorage({
      clientId: env['GOOGLE_CLIENT_ID'] as string,
      clientSecret: env['GOOGLE_CLIENT_SECRET'] as string,
      refreshToken: env['GOOGLE_REFRESH_TOKEN'] as string,
      folderId: env['GOOGLE_DRIVE_CV_FOLDER_ID'] as string,
    });
  }

  throw new Error(`CV_STORAGE must be "local" or "google-drive" (got ${kind ? `"${kind}"` : 'nothing'})`);
}

export const cvStorageProvider: Provider = {
  provide: CvStorage,
  useFactory: () => createCvStorage(),
};
