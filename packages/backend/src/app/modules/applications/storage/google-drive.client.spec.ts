import {
  DRIVE_FILE_SCOPE,
  buildConsentUrl,
  deleteFile,
  downloadFile,
  exchangeAuthCode,
  findOrCreateFolder,
  refreshAccessToken,
  uploadFile,
} from './google-drive.client';

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' }, ...init });

describe('google-drive.client', () => {
  const client = { clientId: 'client-id', clientSecret: 'client-secret' };
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => fetchMock.mockRestore());

  const call = (index: number) => {
    const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit];
    return { url, init, headers: (init.headers ?? {}) as Record<string, string> };
  };

  it('buildConsentUrl() asks for offline access with the drive.file scope only', () => {
    const url = new URL(buildConsentUrl(client, 'http://127.0.0.1:53682'));

    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'client-id',
      redirect_uri: 'http://127.0.0.1:53682',
      response_type: 'code',
      scope: DRIVE_FILE_SCOPE,
      access_type: 'offline',
      prompt: 'consent',
    });
  });

  it('exchangeAuthCode() trades the code for access + refresh tokens', async () => {
    fetchMock.mockResolvedValue(json({ access_token: 'at', refresh_token: 'rt' }));

    await expect(exchangeAuthCode(client, 'the-code', 'http://127.0.0.1:53682')).resolves.toEqual({
      accessToken: 'at',
      refreshToken: 'rt',
    });
    const body = call(0).init.body as URLSearchParams;
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('the-code');
  });

  it('refreshAccessToken() returns the token and when it expires', async () => {
    fetchMock.mockResolvedValue(json({ access_token: 'at', expires_in: 3599 }));
    const before = Date.now();

    const token = await refreshAccessToken(client, 'rt');

    expect(token.accessToken).toBe('at');
    expect(token.expiresAt).toBeGreaterThanOrEqual(before + 3599_000);
    const { url, init } = call(0);
    expect(url).toBe('https://oauth2.googleapis.com/token');
    expect(Object.fromEntries(init.body as URLSearchParams)).toEqual({
      client_id: 'client-id',
      client_secret: 'client-secret',
      refresh_token: 'rt',
      grant_type: 'refresh_token',
    });
  });

  it('refreshAccessToken() throws with Google status + body when refresh fails', async () => {
    fetchMock.mockResolvedValue(new Response('{"error":"invalid_grant"}', { status: 400 }));

    await expect(refreshAccessToken(client, 'revoked')).rejects.toThrow('token refresh failed: 400 {"error":"invalid_grant"}');
  });

  it('uploadFile() opens a resumable session in the folder, then PUTs the bytes', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 200, headers: { Location: 'https://upload.example/session-1' } }))
      .mockResolvedValueOnce(json({ id: 'file-1', webViewLink: 'https://drive.google.com/file/d/file-1/view?usp=drivesdk' }));
    const content = Buffer.from('%PDF-1.7 cv');

    const file = await uploadFile('at', { name: 'cv.pdf', folderId: 'folder-1', mimeType: 'application/pdf', content });

    expect(file).toEqual({ id: 'file-1', webViewLink: 'https://drive.google.com/file/d/file-1/view?usp=drivesdk' });
    const session = call(0);
    expect(session.url).toBe('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink');
    expect(session.init.method).toBe('POST');
    expect(session.headers).toMatchObject({
      Authorization: 'Bearer at',
      'X-Upload-Content-Type': 'application/pdf',
      'X-Upload-Content-Length': String(content.length),
    });
    expect(JSON.parse(session.init.body as string)).toEqual({ name: 'cv.pdf', mimeType: 'application/pdf', parents: ['folder-1'] });
    const put = call(1);
    expect(put.url).toBe('https://upload.example/session-1');
    expect(put.init.method).toBe('PUT');
    expect(put.init.body).toBe(content);
  });

  it('uploadFile() builds the view link when Google does not return one', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 200, headers: { Location: 'https://upload.example/s' } }))
      .mockResolvedValueOnce(json({ id: 'file-2' }));

    const file = await uploadFile('at', { name: 'cv.pdf', folderId: 'f', mimeType: 'application/pdf', content: Buffer.from('%PDF-') });

    expect(file.webViewLink).toBe('https://drive.google.com/file/d/file-2/view');
  });

  it('uploadFile() fails clearly when the session has no Location header', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));

    await expect(
      uploadFile('at', { name: 'cv.pdf', folderId: 'f', mimeType: 'application/pdf', content: Buffer.from('%PDF-') }),
    ).rejects.toThrow('no Location header');
  });

  it('deleteFile() deletes by id and treats 404 as already deleted', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(new Response(null, { status: 404 }));

    await deleteFile('at', 'file-1');
    await expect(deleteFile('at', 'gone')).resolves.toBeUndefined();
    expect(call(0).url).toBe('https://www.googleapis.com/drive/v3/files/file-1');
    expect(call(0).init.method).toBe('DELETE');
  });

  it('findOrCreateFolder() reuses a folder this app already created', async () => {
    fetchMock.mockResolvedValueOnce(json({ files: [{ id: 'existing' }] }));

    await expect(findOrCreateFolder('at', 'cv', 'parent-1')).resolves.toBe('existing');
    const q = new URL(call(0).url).searchParams.get('q');
    expect(q).toBe(
      "name = 'cv' and mimeType = 'application/vnd.google-apps.folder' and 'parent-1' in parents and trashed = false",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('findOrCreateFolder() creates the folder under root when it does not exist', async () => {
    fetchMock.mockResolvedValueOnce(json({ files: [] })).mockResolvedValueOnce(json({ id: 'new-folder' }));

    await expect(findOrCreateFolder('at', 'cv-ai-scanner')).resolves.toBe('new-folder');
    expect(JSON.parse(call(1).init.body as string)).toEqual({
      name: 'cv-ai-scanner',
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['root'],
    });
  });

  it('downloadFile() returns the bytes of the file (hr-applications AC-5)', async () => {
    fetchMock.mockResolvedValueOnce(new Response(Buffer.from('%PDF-1.7 bytes'), { status: 200 }));

    await expect(downloadFile('at', 'file/1')).resolves.toEqual(Buffer.from('%PDF-1.7 bytes'));
    const { url, init } = call(0);
    expect(url).toBe('https://www.googleapis.com/drive/v3/files/file%2F1?alt=media');
    expect(init.headers).toEqual({ Authorization: 'Bearer at' });
  });

  it('downloadFile() returns null for a missing file and throws on other errors', async () => {
    fetchMock.mockResolvedValueOnce(new Response('not found', { status: 404 }));
    await expect(downloadFile('at', 'gone')).resolves.toBeNull();
    fetchMock.mockResolvedValueOnce(new Response('boom', { status: 500 }));
    await expect(downloadFile('at', 'x')).rejects.toThrow('Google Drive download failed: 500');
  });
});
