/** Letters / digits only, accents removed (Vietnamese included), words joined with `separator` */
function words(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** "Lập trình viên Backend (NestJS)" → "lap-trinh-vien-backend-nestjs", cut to `max` characters without a trailing `-` */
export function positionCodeFromTitle(title: string, max = 64): string {
  return words(title).join('-').slice(0, max).replace(/-+$/, '');
}

/** "Quản lý sản phẩm" → "QUAN_LY_SAN_PHAM" */
export function catalogCodeFromName(name: string, max = 64): string {
  return words(name).join('_').toUpperCase().slice(0, max).replace(/_+$/, '');
}

/** `base`, `base-2`, `base-3`… (`separator` before the number), never longer than `max` */
export function withSuffix(base: string, attempt: number, separator: string, max = 64): string {
  if (attempt <= 1) return base;
  const suffix = `${separator}${attempt}`;
  return `${base.slice(0, max - suffix.length).replace(new RegExp(`${separator}+$`), '')}${suffix}`;
}
