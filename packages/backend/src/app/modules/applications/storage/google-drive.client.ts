/**
 * Minimal Google Drive v3 REST client (OAuth of a regular Google account), on top of global fetch.
 * Plain functions without decorators so scripts/drive-auth.ts can import it under Node type stripping.
 *
 * Scope drive.file: the app only sees files and folders it created itself (decision AQ1).
 */

export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

export interface OAuthClient {
  clientId: string;
  clientSecret: string;
}

export interface AccessToken {
  accessToken: string;
  /** Epoch ms */
  expiresAt: number;
}

export interface DriveFile {
  id: string;
  webViewLink: string;
}

async function ensureOk(res: Response, action: string): Promise<Response> {
  if (!res.ok) {
    throw new Error(`Google Drive ${action} failed: ${res.status} ${await res.text()}`);
  }
  return res;
}

/** Consent URL for the one-time setup (offline access → Google returns a refresh token). */
export function buildConsentUrl(client: OAuthClient, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: client.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: DRIVE_FILE_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
  });
  return `${AUTH_URL}?${params}`;
}

export async function exchangeAuthCode(
  client: OAuthClient,
  code: string,
  redirectUri: string,
): Promise<{ accessToken: string; refreshToken?: string }> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    body: new URLSearchParams({
      client_id: client.clientId,
      client_secret: client.clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  await ensureOk(res, 'auth code exchange');
  const json = (await res.json()) as { access_token: string; refresh_token?: string };
  return { accessToken: json.access_token, refreshToken: json.refresh_token };
}

export async function refreshAccessToken(client: OAuthClient, refreshToken: string): Promise<AccessToken> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    body: new URLSearchParams({
      client_id: client.clientId,
      client_secret: client.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  await ensureOk(res, 'token refresh');
  const json = (await res.json()) as { access_token: string; expires_in: number };
  return { accessToken: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
}

/**
 * Resumable upload: CVs can reach 10MB, above the 5MB Google recommends for multipart uploads.
 * 1) open an upload session with the metadata, 2) PUT the bytes to the session URL.
 */
export async function uploadFile(
  accessToken: string,
  file: { name: string; folderId: string; mimeType: string; content: Uint8Array },
): Promise<DriveFile> {
  const session = await fetch(`${UPLOAD_URL}?uploadType=resumable&fields=id,webViewLink`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': file.mimeType,
      'X-Upload-Content-Length': String(file.content.byteLength),
    },
    body: JSON.stringify({ name: file.name, mimeType: file.mimeType, parents: [file.folderId] }),
  });
  await ensureOk(session, 'upload session');
  const sessionUrl = session.headers.get('location');
  if (!sessionUrl) {
    throw new Error('Google Drive upload session failed: no Location header');
  }

  const res = await fetch(sessionUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.mimeType },
    body: file.content,
  });
  await ensureOk(res, 'upload');
  const json = (await res.json()) as { id: string; webViewLink?: string };
  return { id: json.id, webViewLink: json.webViewLink ?? `https://drive.google.com/file/d/${json.id}/view` };
}

/** Deletes a file; a file that is already gone counts as deleted. */
export async function deleteFile(accessToken: string, fileId: string): Promise<void> {
  const res = await fetch(`${FILES_URL}/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 404) return;
  await ensureOk(res, 'delete');
}

/** Returns the id of folder `name` under `parentId`, creating it when this app has not created it yet. */
export async function findOrCreateFolder(accessToken: string, name: string, parentId = 'root'): Promise<string> {
  const query = [
    `name = '${name.replace(/'/g, "\\'")}'`,
    `mimeType = '${FOLDER_MIME_TYPE}'`,
    `'${parentId}' in parents`,
    'trashed = false',
  ].join(' and ');
  const found = await fetch(`${FILES_URL}?${new URLSearchParams({ q: query, fields: 'files(id)' })}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await ensureOk(found, 'folder lookup');
  const { files } = (await found.json()) as { files: { id: string }[] };
  if (files.length > 0) return files[0].id;

  const created = await fetch(`${FILES_URL}?fields=id`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME_TYPE, parents: [parentId] }),
  });
  await ensureOk(created, 'folder creation');
  return ((await created.json()) as { id: string }).id;
}
