import Link from 'next/link';
import type { Dictionary } from '../../i18n/dictionaries';
import { LanguageSwitcher } from './LanguageSwitcher';

export function SiteHeader({ dict }: { dict: Dictionary }) {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-base font-bold text-gray-900">
          {dict.meta.siteName}
        </Link>
        <nav className="flex items-center gap-5 text-sm font-medium text-gray-600">
          <Link href="/" className="hover:text-blue-600">
            {dict.nav.home}
          </Link>
          <Link href="/jobs" className="hover:text-blue-600">
            {dict.nav.jobs}
          </Link>
          <LanguageSwitcher />
        </nav>
      </div>
    </header>
  );
}
