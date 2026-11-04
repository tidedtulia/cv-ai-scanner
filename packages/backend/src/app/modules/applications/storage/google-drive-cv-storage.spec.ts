import * as client from './google-drive.client';
import { GoogleDriveCvStorage } from './google-drive-cv-storage';

jest.mock('./google-drive.client');
const mocked = jest.mocked(client);

describe('GoogleDriveCvStorage', () => {
  const config = { clientId: 'id', clientSecret: 'secret', refreshToken: 'rt', folderId: 'cv-folder' };
  const file = { fileName: 'cv.pdf', content: Buffer.from('%PDF-'), mimeType: 'application/pdf' };

  beforeEach(() => {
    jest.resetAllMocks();
    mocked.refreshAccessToken.mockResolvedValue({ accessToken: 'at-1', expiresAt: Date.now() + 3600_000 });
    mocked.uploadFile.mockResolvedValue({ id: 'file-1', webViewLink: 'https://drive.google.com/file/d/file-1/view' });
  });

  it('upload() sends the CV to the configured folder and maps id / link', async () => {
    const storage = new GoogleDriveCvStorage(config);

    await expect(storage.upload(file)).resolves.toEqual({
      fileId: 'file-1',
      url: 'https://drive.google.com/file/d/file-1/view',
    });
    expect(mocked.uploadFile).toHaveBeenCalledWith('at-1', {
      name: 'cv.pdf',
      folderId: 'cv-folder',
      mimeType: 'application/pdf',
      content: file.content,
    });
  });

  it('reuses the access token until it is about to expire', async () => {
    const storage = new GoogleDriveCvStorage(config);

    await storage.upload(file);
    await storage.remove('file-1');
    expect(mocked.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(mocked.deleteFile).toHaveBeenCalledWith('at-1', 'file-1');
  });

  it('refreshes the access token when it expires within a minute', async () => {
    mocked.refreshAccessToken
      .mockResolvedValueOnce({ accessToken: 'at-1', expiresAt: Date.now() + 30_000 })
      .mockResolvedValueOnce({ accessToken: 'at-2', expiresAt: Date.now() + 3600_000 });
    const storage = new GoogleDriveCvStorage(config);

    await storage.upload(file);
    await storage.upload(file);

    expect(mocked.refreshAccessToken).toHaveBeenCalledTimes(2);
    expect(mocked.uploadFile).toHaveBeenLastCalledWith('at-2', expect.anything());
  });
});
