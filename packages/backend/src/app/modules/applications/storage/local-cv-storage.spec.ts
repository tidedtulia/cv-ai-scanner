import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LocalCvStorage } from './local-cv-storage';

describe('LocalCvStorage', () => {
  let dir: string;
  let storage: LocalCvStorage;

  beforeEach(async () => {
    dir = join(await mkdtemp(join(tmpdir(), 'cv-storage-')), 'nested');
    storage = new LocalCvStorage(dir);
  });

  afterEach(async () => {
    await rm(join(dir, '..'), { recursive: true, force: true });
  });

  it('upload() creates the folder, writes the file and returns a local id + file:// url', async () => {
    const stored = await storage.upload({ fileName: 'a.pdf', content: Buffer.from('%PDF-1.7'), mimeType: 'application/pdf' });

    expect(stored.fileId).toBe('local:a.pdf');
    expect(await readFile(fileURLToPath(stored.url), 'latin1')).toBe('%PDF-1.7');
  });

  it('upload() never overwrites an existing file', async () => {
    const file = { fileName: 'a.pdf', content: Buffer.from('%PDF-1'), mimeType: 'application/pdf' };
    await storage.upload(file);

    await expect(storage.upload(file)).rejects.toThrow(/EEXIST/);
  });

  it('upload() / remove() stay inside the folder (no path traversal)', async () => {
    const stored = await storage.upload({ fileName: '../../evil.pdf', content: Buffer.from('%PDF-'), mimeType: 'application/pdf' });
    expect(stored.fileId).toBe('local:evil.pdf');

    await storage.remove('local:../../evil.pdf');
    await expect(stat(join(dir, 'evil.pdf'))).rejects.toThrow(/ENOENT/);
  });

  it('remove() ignores a file that is already gone', async () => {
    await expect(storage.remove('local:missing.pdf')).resolves.toBeUndefined();
  });
});
