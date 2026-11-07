/**
 * Business values shown on /privacy (FQ2, confirmed 2026-11-07 — D24):
 * where candidates send data requests, and how long CVs are kept.
 */
export const SITE_CONFIG = {
  privacyContactEmail: process.env['NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL'] || 'trantrieu491@gmail.com',
  cvRetentionMonths: 12,
  privacyUpdatedAt: '2026-11-07',
};
