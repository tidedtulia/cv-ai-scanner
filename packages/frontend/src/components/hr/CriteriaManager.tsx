'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CRITERION_GUIDE_MAX_LENGTH, CRITERION_TYPES, CRITERION_WEIGHT_MAX, CRITERION_WEIGHT_MIN, NAME_MAX_LENGTH, type CriterionType, type IHrCriterion, type IHrPositionDetail } from '@org/shared';
import { format } from '../../i18n/format';
import { useI18n } from '../../i18n/I18nProvider';
import { hrRequest, HrSessionExpiredError } from '../../lib/hr-client';
import { positionErrorMessage } from '../../lib/hr-errors';
import { dangerButton, HrDialog, inputClass, primaryButton, secondaryButton } from './HrDialog';

type Dialog = { kind: 'form'; criterion?: IHrCriterion } | { kind: 'delete'; criterion: IHrCriterion };

/** Scoring criteria of a job: list, order, add / edit / delete (hr-positions AC-7, AC-8, AC-15) */
export function CriteriaManager({ positionId, criteria, applicationCount }: { positionId: string; criteria: IHrCriterion[]; applicationCount: number }) {
  const { dict } = useI18n();
  const t = dict.hrPositions.criteria;
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<CriterionType>('TECHNICAL');
  const [weight, setWeight] = useState('3');
  const [isRequired, setIsRequired] = useState(false);
  const [guide, setGuide] = useState('');
  const base = `/api/hr/positions/${positionId}/criteria`;

  const openForm = (criterion?: IHrCriterion) => {
    setName(criterion?.name ?? '');
    setType(criterion?.type ?? 'TECHNICAL');
    setWeight(String(criterion?.weight ?? 3));
    setIsRequired(criterion?.isRequired ?? false);
    setGuide(criterion?.description ?? '');
    setError(null);
    setDialog({ kind: 'form', criterion });
  };
  const close = () => setDialog(null);

  /** Runs a call; on success refreshes the page, on failure puts the message in the dialog (or the page) */
  const run = async (call: () => ReturnType<typeof hrRequest<IHrPositionDetail>>, inDialog: boolean) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await call();
      if (!result.ok) {
        const text = positionErrorMessage(dict, result.body.code);
        if (inDialog) setError(text);
        else setNotice(text);
      } else {
        setDialog(null);
        router.refresh();
      }
    } catch (cause) {
      if (!(cause instanceof HrSessionExpiredError)) (inDialog ? setError : setNotice)(dict.hrPositions.genericError);
    }
    setBusy(false);
  };

  const save = () => {
    const w = Number(weight);
    if (!name.trim()) return setError(positionErrorMessage(dict, 'NAME_REQUIRED'));
    if (name.trim().length > NAME_MAX_LENGTH) return setError(positionErrorMessage(dict, 'NAME_TOO_LONG'));
    if (weight.trim() === '' || !Number.isInteger(w) || w < CRITERION_WEIGHT_MIN || w > CRITERION_WEIGHT_MAX) return setError(positionErrorMessage(dict, 'WEIGHT_INVALID'));
    if (guide.length > CRITERION_GUIDE_MAX_LENGTH) return setError(positionErrorMessage(dict, 'GUIDE_TOO_LONG'));
    const data = { name, type, weight: w, isRequired, description: guide };
    const edit = dialog?.kind === 'form' ? dialog.criterion : undefined;
    return run(() => (edit ? hrRequest<IHrPositionDetail>('PATCH', `${base}/${edit.id}`, data) : hrRequest<IHrPositionDetail>('POST', base, data)), true);
  };

  const small = 'rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-900">{t.title}</h2>
        <button type="button" onClick={() => openForm()} className={primaryButton}>
          {t.add}
        </button>
      </div>
      <p className="text-xs text-gray-500">{t.publicNote}</p>
      {applicationCount > 0 && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{format(t.warning, { n: applicationCount })}</p>}
      {notice && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {notice}
        </p>
      )}

      {criteria.length === 0 ? (
        <p className="rounded-md border border-gray-200 bg-white px-4 py-4 text-sm text-gray-600">{t.empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-600">
              <tr>
                {(['name', 'type', 'weight', 'guide', 'actions'] as const).map((column) => (
                  <th key={column} scope="col" className="px-3 py-2">
                    {t.columns[column]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 align-top">
              {criteria.map((criterion, index) => (
                <tr key={criterion.id}>
                  <td className="px-3 py-2 font-medium">
                    {criterion.name}
                    {criterion.isRequired && <span className="ml-2 rounded bg-gray-800 px-1.5 py-0.5 text-xs text-white">{t.required}</span>}
                  </td>
                  <td className="px-3 py-2">{dict.hrApplications.criterionType[criterion.type]}</td>
                  <td className="px-3 py-2">{criterion.weight}</td>
                  <td className="px-3 py-2 text-gray-600">{criterion.description}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <button type="button" disabled={busy || index === 0} aria-label={`${t.up}: ${criterion.name}`} onClick={() => run(() => hrRequest<IHrPositionDetail>('POST', `${base}/${criterion.id}/move`, { direction: 'up' }), false)} className={small}>
                        {t.up}
                      </button>
                      <button type="button" disabled={busy || index === criteria.length - 1} aria-label={`${t.down}: ${criterion.name}`} onClick={() => run(() => hrRequest<IHrPositionDetail>('POST', `${base}/${criterion.id}/move`, { direction: 'down' }), false)} className={small}>
                        {t.down}
                      </button>
                      <button type="button" aria-label={`${t.edit}: ${criterion.name}`} onClick={() => openForm(criterion)} className={small}>
                        {t.edit}
                      </button>
                      <button
                        type="button"
                        aria-label={`${t.delete}: ${criterion.name}`}
                        onClick={() => {
                          setError(null);
                          setDialog({ kind: 'delete', criterion });
                        }}
                        className={small}
                      >
                        {t.delete}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialog?.kind === 'form' && (
        <HrDialog title={dialog.criterion ? t.editTitle : t.addTitle} onClose={close} busy={busy}>
          <label className="block text-sm font-medium text-gray-700">
            {t.name}
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-gray-700">
              {t.type}
              <select value={type} onChange={(e) => setType(e.target.value as CriterionType)} className={inputClass}>
                {CRITERION_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {dict.hrApplications.criterionType[value]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-gray-700">
              {t.weight}
              <input type="number" min={CRITERION_WEIGHT_MIN} max={CRITERION_WEIGHT_MAX} step={1} value={weight} onChange={(e) => setWeight(e.target.value)} className={inputClass} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input type="checkbox" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} />
            {t.isRequired}
          </label>
          <label className="block text-sm font-medium text-gray-700">
            {t.guide}
            <textarea value={guide} onChange={(e) => setGuide(e.target.value)} rows={4} className={inputClass} />
          </label>
          <p className="text-right text-xs text-gray-500">{format(t.guideCount, { count: guide.length, max: CRITERION_GUIDE_MAX_LENGTH })}</p>
          {error && (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={close} disabled={busy} className={secondaryButton}>
              {t.cancel}
            </button>
            <button type="button" onClick={save} disabled={busy} className={primaryButton}>
              {busy ? t.saving : t.save}
            </button>
          </div>
        </HrDialog>
      )}

      {dialog?.kind === 'delete' && (
        <HrDialog title={format(t.deleteTitle, { name: dialog.criterion.name })} onClose={close} busy={busy}>
          <p className="text-sm text-gray-700">{t.deleteText}</p>
          {error && (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={close} disabled={busy} className={secondaryButton}>
              {t.cancel}
            </button>
            <button type="button" onClick={() => run(() => hrRequest<IHrPositionDetail>('DELETE', `${base}/${dialog.criterion.id}`), true)} disabled={busy} className={dangerButton}>
              {busy ? t.saving : t.confirm}
            </button>
          </div>
        </HrDialog>
      )}
    </div>
  );
}
