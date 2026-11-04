/**
 * One-time Google Drive setup for CV storage (OAuth of a regular Google account, scope drive.file):
 *   1. opens Google's consent page and catches the redirect on 127.0.0.1
 *   2. creates (or reuses) the folders cv-ai-scanner/cv — with drive.file the app can only use folders it created
 *   3. prints GOOGLE_REFRESH_TOKEN and GOOGLE_DRIVE_CV_FOLDER_ID to put in the root .env
 *
 * Needs GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET of a "Desktop app" OAuth client in .env.
 * Guide: docs/features/submit-application-api/google-drive-setup.md
 *
 * Run from packages/backend (Node >= 22):  npm run drive:auth
 */
import { createServer } from 'node:http';
import { config } from 'dotenv';
import { buildConsentUrl, exchangeAuthCode, findOrCreateFolder } from '../src/app/modules/applications/storage/google-drive.client.ts';

config({ path: ['.env', '../../.env'], quiet: true });

// Desktop-app OAuth clients accept any loopback port without registering it
const PORT = 53682;
const redirectUri = `http://127.0.0.1:${PORT}`;

/** Waits for Google to redirect back with ?code=… (or ?error=…). */
function waitForAuthCode(consentUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const params = new URL(req.url ?? '/', redirectUri).searchParams;
      const authCode = params.get('code');
      const error = params.get('error');
      if (!authCode && !error) {
        res.writeHead(404).end(); // e.g. the browser asking for /favicon.ico
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(authCode ? 'Done — you can close this tab and go back to the terminal.' : `Authorization failed: ${error}`);
      server.close();
      if (authCode) resolve(authCode);
      else reject(new Error(`Authorization failed: ${error}`));
    });
    server.listen(PORT, '127.0.0.1', () => {
      console.log('Open this URL and sign in with the Google account that will own the CVs:\n');
      console.log(`${consentUrl}\n`);
    });
  });
}

async function main() {
  const clientId = process.env['GOOGLE_CLIENT_ID'];
  const clientSecret = process.env['GOOGLE_CLIENT_SECRET'];
  if (!clientId || !clientSecret) {
    throw new Error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env first.');
  }
  const client = { clientId, clientSecret };

  const code = await waitForAuthCode(buildConsentUrl(client, redirectUri));
  const tokens = await exchangeAuthCode(client, code, redirectUri);
  if (!tokens.refreshToken) {
    throw new Error(
      'Google did not return a refresh token. Remove the app at https://myaccount.google.com/permissions and run again.',
    );
  }

  const rootFolderId = await findOrCreateFolder(tokens.accessToken, 'cv-ai-scanner');
  const cvFolderId = await findOrCreateFolder(tokens.accessToken, 'cv', rootFolderId);

  console.log('Add these lines to the root .env (keep the token secret, never commit it):\n');
  console.log('CV_STORAGE=google-drive');
  console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refreshToken}`);
  console.log(`GOOGLE_DRIVE_CV_FOLDER_ID=${cvFolderId}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
