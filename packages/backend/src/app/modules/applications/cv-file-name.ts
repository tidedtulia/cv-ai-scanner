/** Timestamps in CV file names use company time, so HR reads them as-is in Drive. */
const VIETNAM_TIME = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const SLUG_MAX_LENGTH = 50;

/** "Nguyễn Văn Đức" → "nguyen-van-duc" */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, '');
}

/**
 * Drive file name (decision AQ3): `<YYYYMMDD-HHmmss>_<position code>_<name>_<first 8 chars of application id>.pdf`
 * e.g. 20261105-093012_frontend-dev_nguyen-van-a_3f1c2b9a.pdf
 */
export function buildCvFileName(input: {
  submittedAt: Date;
  positionCode: string;
  fullName: string;
  applicationId: string;
}): string {
  const parts = Object.fromEntries(VIETNAM_TIME.formatToParts(input.submittedAt).map((p) => [p.type, p.value]));
  const timestamp = `${parts['year']}${parts['month']}${parts['day']}-${parts['hour']}${parts['minute']}${parts['second']}`;
  const name = slugify(input.fullName) || 'candidate';
  return `${timestamp}_${slugify(input.positionCode)}_${name}_${input.applicationId.slice(0, 8)}.pdf`;
}
