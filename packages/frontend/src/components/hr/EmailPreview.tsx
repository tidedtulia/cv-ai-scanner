'use client';

import { useEffect, useState } from 'react';
import type { HrDecision, IHrEmailPreview } from '@org/shared';
import { useI18n } from '../../i18n/I18nProvider';
import { hrFetch, HrSessionExpiredError } from '../../lib/hr-client';

type State = { phase: 'loading' } | { phase: 'error' } | { phase: 'ready'; preview: IHrEmailPreview };

/**
 * Read-only preview of the result email of a decision, in the candidate's language (result-email AC-9).
 * A preview that cannot be loaded never blocks the decision: it only says so.
 */
export function EmailPreview({ applicationId, decision }: { applicationId: string; decision: HrDecision }) {
  const { dict } = useI18n();
  const t = dict.hrApplications.emailPreview;
  const [state, setState] = useState<State>({ phase: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ phase: 'loading' });
    hrFetch(`/api/hr/applications/${applicationId}/email-preview?decision=${decision}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`preview ${response.status}`);
        return (await response.json()) as IHrEmailPreview;
      })
      .then((preview) => {
        if (!cancelled) setState({ phase: 'ready', preview });
      })
      .catch((cause) => {
        if (!cancelled && !(cause instanceof HrSessionExpiredError)) setState({ phase: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId, decision]);

  return (
    <section aria-label={t.title} className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
      <h3 className="font-semibold text-gray-800">{t.title}</h3>
      {state.phase === 'loading' && <p className="text-gray-600">{t.loading}</p>}
      {state.phase === 'error' && <p className="text-gray-600">{t.error}</p>}
      {state.phase === 'ready' && (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-gray-500">{t.language}</dt>
            <dd>{t.locales[state.preview.locale]}</dd>
            <dt className="text-gray-500">{t.to}</dt>
            <dd className="break-all">{state.preview.to}</dd>
            <dt className="text-gray-500">{t.subject}</dt>
            <dd>{state.preview.subject}</dd>
          </dl>
          <div>
            <p className="text-gray-500">{t.body}</p>
            <pre className="mt-1 max-h-60 overflow-y-auto rounded border border-gray-200 bg-white p-3 font-sans whitespace-pre-wrap text-gray-800">{state.preview.text}</pre>
          </div>
        </>
      )}
    </section>
  );
}
