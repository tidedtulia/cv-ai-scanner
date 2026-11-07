/** Dates of the HR area: dd/MM/yyyy [HH:mm], always in Vietnam time, in both UI languages (hr-applications AC-18) */
const TIME_ZONE = 'Asia/Ho_Chi_Minh';

const parts = (iso: string) => {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return Object.fromEntries(formatter.formatToParts(new Date(iso)).map((part) => [part.type, part.value]));
};

export function formatDate(iso: string): string {
  const p = parts(iso);
  return `${p['day']}/${p['month']}/${p['year']}`;
}

export function formatDateTime(iso: string): string {
  const p = parts(iso);
  return `${p['day']}/${p['month']}/${p['year']} ${p['hour']}:${p['minute']}`;
}

/** 83.33 → "83.3", 90 → "90" */
export const formatScore = (score: number) => String(Math.round(score * 10) / 10);
