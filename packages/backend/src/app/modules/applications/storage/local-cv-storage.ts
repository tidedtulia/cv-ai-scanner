import { mkdir, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CvStorage, CvUpload, StoredCv } from './cv-storage';

const LOCAL_ID_PREFIX = 'local:';

/** Dev / test only: keeps CVs in a folder on this machine (CV_STORAGE=local). */
export class LocalCvStorage extends CvStorage {
  constructor(private readonly dir: string) {
    super();
  }

  async upload(file: CvUpload): Promise<StoredCv> {
    await mkdir(this.dir, { recursive: true });
    const path = join(this.dir, basename(file.fileName));
    await writeFile(path, file.content, { flag: 'wx' });
    return { fileId: `${LOCAL_ID_PREFIX}${basename(path)}`, url: pathToFileURL(path).href };
  }

  async remove(fileId: string): Promise<void> {
    await rm(join(this.dir, basename(fileId.slice(LOCAL_ID_PREFIX.length))), { force: true });
  }
}
