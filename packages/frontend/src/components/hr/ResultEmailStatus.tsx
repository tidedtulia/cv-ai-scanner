'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ApplicationStatus, HrDecision, IHrApplicationDetail } from '@org/shared';
import { HR_DECIDED_STATUSES } from '@org/shared';
import { format } from '../../i18n/format';
import { formatDateTime } from '../../i18n/format-date';
import { useI18n } from '../../i18n/I18nProvider';
import { hrRequest, HrSessionExpiredError } from '../../lib/hr-client';
import { EmailPreview } from './EmailPreview';
import { HrDialog, primaryButton, secondaryButton } from './HrDialog';

type Props = { application: Pick<IHrApplicationDetail, 'id' | 'fullName' | 'email' | 'resultEmailSentAt' | 'canResendEmail'> & { status: ApplicationStatus } };

/** "Email kết quả": when it was sent, or "not sent" with a Resend button + confirmation (result-email AC-11) */
export function ResultEmailStatus({ application }: Props) {
  const { dict } = useI18n();
  const t = dict.hrApplications.email;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!HR_DECIDED_STATUSES.includes(application.status)) return null;
  const decision = application.status as HrDecision;

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      const result = await hrRequest('POST', `/api/hr/applications/${application.id}/resend-email`, {});
      if (result.ok || result.status === 409) {
        setOpen(false);
        setNotice(result.ok ? t.sent : result.body.code === 'EMAIL_ALREADY_SENT' ? t.alreadySent : t.conflict);
        router.refresh();
      } else {
        setError(t.failed);
      }
    } catch (cause) {
      if (!(cause instanceof HrSessionExpiredError)) setError(t.failed);
    }
    setSending(false);
  };

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-bold text-gray-900">{t.title}</h2>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {application.resultEmailSentAt ? (
          <p className="text-gray-700">{format(t.sentAt, { date: formatDateTime(application.resultEmailSentAt) })}</p>
        ) : (
          <p className="font-medium text-amber-800">{t.notSent}</p>
        )}
        {application.canResendEmail && (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setOpen(true);
            }}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            {t.resend}
          </button>
        )}
      </div>
      {notice && (
        <p role="status" className="rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">
          {notice}
        </p>
      )}

      {open && (
        <HrDialog title={format(t.resendTitle, { name: application.fullName })} onClose={() => setOpen(false)} busy={sending}>
          <p className="text-sm text-gray-700">{format(t.resendText, { email: application.email })}</p>
          <EmailPreview applicationId={application.id} decision={decision} />
          {error && (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setOpen(false)} disabled={sending} className={secondaryButton}>
              {dict.hrApplications.actions.cancel}
            </button>
            <button type="button" onClick={send} disabled={sending} className={primaryButton}>
              {sending ? t.sending : t.send}
            </button>
          </div>
        </HrDialog>
      )}
    </div>
  );
}
