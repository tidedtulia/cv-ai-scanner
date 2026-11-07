'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import type { IPublicPositionDetail } from '@org/shared';
import { useI18n } from '../../i18n/I18nProvider';
import { clientApi } from '../../lib/client-api';
import { experienceLabel } from '../jobs/JobCard';

type DetailState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; position: IPublicPositionDetail };

/**
 * Styles for the JD markdown written by HR. react-markdown never renders raw HTML and drops
 * unsafe URLs (javascript:), so HR content can't inject scripts (FQ4).
 */
const MARKDOWN_COMPONENTS: Components = {
  h1: ({ children }) => <h3 className="mt-4 text-sm font-semibold text-gray-900">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-4 text-sm font-semibold text-gray-900">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-3 text-sm font-semibold text-gray-900">{children}</h4>,
  p: ({ children }) => <p className="mt-2 text-sm text-gray-700">{children}</p>,
  ul: ({ children }) => <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-gray-700">{children}</ul>,
  ol: ({ children }) => <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-gray-700">{children}</ol>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-blue-600 underline">
      {children}
    </a>
  ),
};

/** JD + criteria of the selected job (D10), loaded from GET /api/positions/:code. */
export function PositionDetails({ code }: { code: string }) {
  const { dict } = useI18n();
  const [state, setState] = useState<DetailState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    fetch(clientApi.position(code), { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`GET position ${code}: ${res.status}`);
        return res.json() as Promise<IPublicPositionDetail>;
      })
      .then((position) => setState({ status: 'ready', position }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'error' });
      });
    return () => controller.abort();
  }, [code]);

  if (state.status === 'loading') {
    return <p className="text-sm text-gray-500">{dict.submit.jdLoading}</p>;
  }
  if (state.status === 'error') {
    return <p className="text-sm text-red-600">{dict.submit.jdError}</p>;
  }

  const { position } = state;
  return (
    <section aria-label={position.title} className="rounded-md border border-blue-100 bg-blue-50/50 px-4 py-3">
      <p className="text-xs font-medium text-gray-500">
        {position.category.name} · {position.level.name} · {experienceLabel(position.minYearsExperience, dict.jobs)}
      </p>
      <div className="mt-1">
        <ReactMarkdown components={MARKDOWN_COMPONENTS}>{position.description}</ReactMarkdown>
      </div>
      <h3 id={`criteria-${position.code}`} className="mt-4 text-sm font-semibold text-gray-900">
        {dict.submit.criteriaTitle}
      </h3>
      <ul aria-labelledby={`criteria-${position.code}`} className="mt-2 flex flex-wrap gap-2">
        {position.criteria.map((criterion, index) => (
          <li key={`${criterion.name}-${index}`} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-100">
            {criterion.name}
          </li>
        ))}
      </ul>
    </section>
  );
}
