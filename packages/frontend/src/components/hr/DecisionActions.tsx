'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { HR_DECISION_NOTE_MAX_LENGTH, type HrDecision, type IHrApplicationDetail } from '@org/shared';
import { format } from '../../i18n/format';
import { useI18n } from '../../i18n/I18nProvider';
import { hrFetch, HrSessionExpiredError } from '../../lib/hr-client';

type Action = HrDecision | 're-evaluate';

/** Accept / Reject / Re-evaluate with a confirmation dialog (hr-applications AC-16, AC-17, AC-18) */
export function DecisionActions({ application }: { application: Pick<IHrApplicationDetail, 'id' | 'fullName' | 'canDecide' | 'canReEvaluate'> & { positionTitle: string } }) {
  const { dict } = useI18n();
  const t = dict.hrApplications.actions;
  const router = useRouter();
  const [action, setAction] = useState<Action | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (action) dialogRef.current?.focus();
  }, [action]);

  if (!application.canDecide && !application.canReEvaluate && !notice) return null;

  const open = (next: Action, event: React.MouseEvent<HTMLElement>) => {
    openerRef.current = event.currentTarget;
    setAction(next);
    setNote('');
    setError(null);
  };
  const close = () => {
    setAction(null);
    setTimeout(() => openerRef.current?.focus(), 0);
  };

  const confirm = async () => {
    if (!action) return;
    setSaving(true);
    setError(null);
    try {
      const url = `/api/hr/applications/${application.id}/${action === 're-evaluate' ? 're-evaluate' : 'decision'}`;
      const response = await hrFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 're-evaluate' ? {} : { decision: action, note }),
      });
      if (response.ok) {
        setAction(null);
        setNotice(action === 're-evaluate' ? t.reEvaluateSaved : t.saved);
        router.refresh();
      } else if (response.status === 409) {
        setAction(null);
        setNotice(t.conflict);
        router.refresh();
      } else {
        setError(t.error);
      }
    } catch (cause) {
      if (!(cause instanceof HrSessionExpiredError)) setError(t.error);
    }
    setSaving(false);
  };

  const title =
    action === 're-evaluate'
      ? t.reEvaluateTitle
      : format(action === 'ACCEPTED' ? t.acceptTitle : t.rejectTitle, { name: application.fullName, position: application.positionTitle });
  const button = 'rounded-md px-4 py-2 text-sm font-semibold';

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {application.canDecide && (
          <>
            <button type="button" onClick={(e) => open('ACCEPTED', e)} className={`${button} bg-green-600 text-white hover:bg-green-700`}>
              {t.accept}
            </button>
            <button type="button" onClick={(e) => open('REJECTED', e)} className={`${button} bg-red-600 text-white hover:bg-red-700`}>
              {t.reject}
            </button>
          </>
        )}
        {application.canReEvaluate && (
          <button type="button" onClick={(e) => open('re-evaluate', e)} className={`${button} border border-gray-300 bg-white text-gray-800 hover:bg-gray-100`}>
            {t.reEvaluate}
          </button>
        )}
      </div>
      {notice && (
        <p role="status" className="mt-3 rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">
          {notice}
        </p>
      )}

      {action && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="decision-title"
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && !saving) close();
            }}
            className="w-full max-w-md space-y-4 rounded-lg bg-white p-6 shadow-xl focus:outline-none"
          >
            <h2 id="decision-title" className="text-lg font-bold text-gray-900">{title}</h2>
            {action === 're-evaluate' ? (
              <p className="text-sm text-gray-700">{t.reEvaluateText}</p>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-700">{t.final}</p>
                <label className="block text-sm font-medium text-gray-700">
                  {t.note}
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={HR_DECISION_NOTE_MAX_LENGTH}
                    rows={4}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
                <p className="text-right text-xs text-gray-500">{format(t.noteCount, { count: note.length, max: HR_DECISION_NOTE_MAX_LENGTH })}</p>
              </>
            )}
            {error && (
              <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={close} disabled={saving} className={`${button} border border-gray-300 text-gray-700 hover:bg-gray-100`}>
                {t.cancel}
              </button>
              <button type="button" onClick={confirm} disabled={saving} className={`${button} bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60`}>
                {saving ? t.saving : t.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
