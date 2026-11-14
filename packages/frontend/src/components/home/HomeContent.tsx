import Link from 'next/link';
import { CV_MAX_FILE_SIZE_MB } from '@org/shared';
import type { Dictionary } from '../../i18n/dictionaries';
import { format } from '../../i18n/format';

export function HomeContent({ dict }: { dict: Dictionary['home'] }) {
  return (
    <div className="mx-auto max-w-5xl 2xl:max-w-7xl min-[1920px]:max-w-[90rem] px-4 py-16">
      <section className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">{dict.title}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-gray-600">{dict.subtitle}</p>
        <Link
          href="/jobs"
          className="mt-8 inline-block rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
        >
          {dict.cta}
        </Link>
      </section>

      <section className="mt-16" aria-labelledby="how-to-apply">
        <h2 id="how-to-apply" className="text-center text-xl font-semibold text-gray-900">
          {dict.stepsTitle}
        </h2>
        <ol className="mt-8 grid gap-6 sm:grid-cols-3">
          {dict.steps.map((step, index) => (
            <li key={step.title} className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">
                {index + 1}
              </span>
              <h3 className="mt-4 font-semibold text-gray-900">{step.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{format(step.text, { maxMb: CV_MAX_FILE_SIZE_MB })}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
