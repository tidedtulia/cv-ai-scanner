import { resolve } from 'node:path';
import { createCvStorage } from './cv-storage.provider';
import { GoogleDriveCvStorage } from './google-drive-cv-storage';
import { LocalCvStorage } from './local-cv-storage';

describe('createCvStorage (AC-5)', () => {
  const google = {
    CV_STORAGE: 'google-drive',
    GOOGLE_CLIENT_ID: 'id',
    GOOGLE_CLIENT_SECRET: 'secret',
    GOOGLE_REFRESH_TOKEN: 'rt',
    GOOGLE_DRIVE_CV_FOLDER_ID: 'folder',
  };

  it('CV_STORAGE=local → LocalCvStorage in CV_LOCAL_DIR (default tmp/cv-uploads)', () => {
    const storage = createCvStorage({ CV_STORAGE: 'local' });

    expect(storage).toBeInstanceOf(LocalCvStorage);
    expect((storage as unknown as { dir: string }).dir).toBe(resolve('tmp/cv-uploads'));
  });

  it('CV_STORAGE=google-drive with every variable → GoogleDriveCvStorage', () => {
    expect(createCvStorage(google)).toBeInstanceOf(GoogleDriveCvStorage);
  });

  it('CV_STORAGE=google-drive names the missing variables', () => {
    expect(() =>
      createCvStorage({ ...google, GOOGLE_REFRESH_TOKEN: '', GOOGLE_DRIVE_CV_FOLDER_ID: undefined }),
    ).toThrow('CV_STORAGE=google-drive requires GOOGLE_REFRESH_TOKEN, GOOGLE_DRIVE_CV_FOLDER_ID');
  });

  it('missing or unknown CV_STORAGE fails at startup', () => {
    expect(() => createCvStorage({})).toThrow('CV_STORAGE must be "local" or "google-drive" (got nothing)');
    expect(() => createCvStorage({ CV_STORAGE: 's3' })).toThrow('(got "s3")');
  });
});
