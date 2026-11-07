import type { Metadata } from 'next';

/** Whole HR area: never indexed (hr-auth AC-9). src/proxy.ts also sends X-Robots-Tag + Cache-Control: no-store. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function HrAreaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
