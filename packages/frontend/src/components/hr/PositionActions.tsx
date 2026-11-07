'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { PositionStatus } from '@org/shared';
import { format } from '../../i18n/format';
import { useI18n } from '../../i18n/I18nProvider';
import { hrRequest, HrSessionExpiredError } from '../../lib/hr-client';
import { positionErrorMessage } from '../../lib/hr-errors';
import { dangerButton, HrDialog, primaryButton, secondaryButton } from './HrDialog';

type Pending = { kind: 'status'; to: PositionStatus; label: string; text: string } | { kind: 'delete' };

/** Open / close / back to draft and delete a job, each with a confirmation (hr-positions AC-16) */
export function PositionActions({ job }: { job: { id: string; code: string; title: string; status: PositionStatus; applicationCount: number } }) {
  const { dict } = useI18n();
  const t = dict.hrPositions.actions;
  const router = useRouter();
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const status = (to: PositionStatus, label: string, text: string): Pending => ({ kind: 'status', to, label, text });
  const buttons: { label: string; pending: Pending }[] =
    job.status === 'DRAFT'
      ? [{ label: t.open, pending: status('OPEN', t.open, t.openConfirm) }]
      : job.status === 'OPEN'
        ? [
            { label: t.close, pending: status('CLOSED', t.close, t.closeConfirm) },
            { label: t.toDraft, pending: status('DRAFT', t.toDraft, t.draftConfirm) },
          ]
        : [{ label: t.reopen, pending: status('OPEN', t.reopen, t.openConfirm) }];

  const open = (next: Pending) => {
    setPending(next);
    setError(null);
  };
  const close = () => setPending(null);

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const result =
        pending.kind === 'delete'
          ? await hrRequest('DELETE', `/api/hr/positions/${job.id}`)
          : await hrRequest('POST', `/api/hr/positions/${job.id}/status`, { status: pending.to });
      if (!result.ok) {
        setError(positionErrorMessage(dict, result.body.code));
      } else if (pending.kind === 'delete') {
        router.replace('/hr/positions');
        router.refresh();
        return;
      } else {
        setPending(null);
        setNotice(t.saved);
        router.refresh();
      }
    } catch (cause) {
      if (!(cause instanceof HrSessionExpiredError)) setError(dict.hrPositions.genericError);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {buttons.map((button) => (
          <button key={button.label} type="button" onClick={() => open(button.pending)} className={primaryButton}>
            {button.label}
          </button>
        ))}
        {job.applicationCount === 0 && (
          <button type="button" onClick={() => open({ kind: 'delete' })} className={dangerButton}>
            {t.delete}
          </button>
        )}
      </div>
      {job.applicationCount > 0 && (
        <p className="text-sm text-gray-700">
          {format(t.deleteBlocked, { n: job.applicationCount })}{' '}
          <Link href={`/hr?tab=all&position=${encodeURIComponent(job.code)}`} className="text-blue-700 hover:underline">
            {format(t.applications, { n: job.applicationCount })}
          </Link>
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">
          {notice}
        </p>
      )}

      {pending && (
        <HrDialog title={pending.kind === 'delete' ? format(t.deleteTitle, { title: job.title }) : pending.label} onClose={close} busy={busy}>
          <p className="text-sm text-gray-700">{pending.kind === 'delete' ? t.deleteText : pending.text}</p>
          {error && (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={close} disabled={busy} className={secondaryButton}>
              {t.cancel}
            </button>
            <button type="button" onClick={confirm} disabled={busy} className={pending.kind === 'delete' ? dangerButton : primaryButton}>
              {busy ? t.saving : pending.kind === 'delete' ? t.delete : t.confirm}
            </button>
          </div>
        </HrDialog>
      )}
    </div>
  );
}
