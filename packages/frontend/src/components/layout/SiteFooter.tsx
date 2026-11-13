import Link from 'next/link';
import type { Dictionary } from '../../i18n/dictionaries';

export function SiteFooter({ dict }: { dict: Dictionary }) {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl 2xl:max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
        <p>{dict.footer.aiNote}</p>
        <Link href="/privacy" className="font-medium text-gray-600 hover:text-blue-600">
          {dict.footer.privacy}
        </Link>
      </div>
    </footer>
  );
}
