'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { NAME_MAX_LENGTH, type IHrCatalogItem } from '@org/shared';
import { format } from '../../i18n/format';
import { useI18n } from '../../i18n/I18nProvider';
import { hrRequest, HrSessionExpiredError } from '../../lib/hr-client';
import { positionErrorMessage } from '../../lib/hr-errors';
import { HrDialog, inputClass, primaryButton, secondaryButton } from './HrDialog';

type Dialog = { kind: 'form'; item?: IHrCatalogItem } | { kind: 'hide'; item: IHrCatalogItem };

/** One catalog table (categories or levels): add, rename, reorder, hide / show — never delete (hr-positions AC-17) */
export function CatalogManager({ kind, items }: { kind: 'category' | 'level'; items: IHrCatalogItem[] }) {
  const { dict } = useI18n();
  const t = dict.hrCatalog;
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [order, setOrder] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const base = kind === 'category' ? '/api/hr/job-categories' : '/api/hr/job-levels';
  const heading = kind === 'category' ? t.categories : t.levels;

  const openForm = (item?: IHrCatalogItem) => {
    setName(item?.name ?? '');
    setCode('');
    setOrder(item ? String(item.sortOrder) : '');
    setError(null);
    setDialog({ kind: 'form', item });
  };
  const close = () => setDialog(null);

  const send = async (call: () => ReturnType<typeof hrRequest>) => {
    setBusy(true);
    setError(null);
    try {
      const result = await call();
      if (!result.ok) setError(positionErrorMessage(dict, result.body.code));
      else {
        setDialog(null);
        setNotice(t.saved);
        router.refresh();
      }
    } catch (cause) {
      if (!(cause instanceof HrSessionExpiredError)) setError(dict.hrPositions.genericError);
    }
    setBusy(false);
  };

  const save = () => {
    if (!name.trim()) return setError(positionErrorMessage(dict, 'NAME_REQUIRED'));
    if (name.trim().length > NAME_MAX_LENGTH) return setError(positionErrorMessage(dict, 'NAME_TOO_LONG'));
    const sortOrder = order.trim() === '' ? undefined : Number(order);
    if (sortOrder !== undefined && !Number.isInteger(sortOrder)) return setError(positionErrorMessage(dict, 'SORT_ORDER_INVALID'));
    const edit = dialog?.kind === 'form' ? dialog.item : undefined;
    return send(() =>
      edit
        ? hrRequest('PATCH', `${base}/${edit.id}`, { name, ...(sortOrder === undefined ? {} : { sortOrder }) })
        : hrRequest('POST', base, { name, ...(code.trim() ? { code: code.trim() } : {}), ...(sortOrder === undefined ? {} : { sortOrder }) }),
    );
  };

  const toggle = (item: IHrCatalogItem) => {
    if (item.isActive) {
      setError(null);
      setDialog({ kind: 'hide', item });
    } else {
      void send(() => hrRequest('PATCH', `${base}/${item.id}`, { isActive: true }));
    }
  };

  const small = 'rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-900">{heading}</h2>
        <button type="button" onClick={() => openForm()} className={primaryButton}>
          {kind === 'category' ? t.addCategory : t.addLevel}
        </button>
      </div>
      {kind === 'level' && <p className="text-xs text-gray-500">{t.levelsHint}</p>}
      {notice && (
        <p role="status" className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {notice}
        </p>
      )}
      {!dialog && error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <caption className="sr-only">{heading}</caption>
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-600">
            <tr>
              {(['name', 'code', 'order', 'jobs', 'status', 'actions'] as const).map((column) => (
                <th key={column} scope="col" className="px-3 py-2">
                  {t.columns[column]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item) => (
              <tr key={item.id} className={item.isActive ? '' : 'text-gray-400'}>
                <td className="px-3 py-2 font-medium">{item.name}</td>
                <td className="px-3 py-2 font-mono text-xs">{item.code}</td>
                <td className="px-3 py-2">{item.sortOrder}</td>
                <td className="px-3 py-2">{item.positionCount}</td>
                <td className="px-3 py-2">{item.isActive ? t.shown : t.hidden}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button type="button" aria-label={`${t.edit}: ${item.name}`} onClick={() => openForm(item)} className={small}>
                      {t.edit}
                    </button>
                    <button type="button" aria-label={`${item.isActive ? t.hide : t.show}: ${item.name}`} onClick={() => toggle(item)} disabled={busy} className={small}>
                      {item.isActive ? t.hide : t.show}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dialog?.kind === 'form' && (
        <HrDialog title={dialog.item ? format(t.editTitle, { name: dialog.item.name }) : kind === 'category' ? t.addCategory : t.addLevel} onClose={close} busy={busy}>
          <label className="block text-sm font-medium text-gray-700">
            {t.name}
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </label>
          {!dialog.item && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t.code}
                <input value={code} onChange={(e) => setCode(e.target.value)} className={inputClass} />
              </label>
              <p className="mt-1 text-xs text-gray-500">{t.codeHint}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t.order}
              <input type="number" step={1} value={order} onChange={(e) => setOrder(e.target.value)} className={inputClass} />
            </label>
            {!dialog.item && <p className="mt-1 text-xs text-gray-500">{t.orderHint}</p>}
          </div>
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

      {dialog?.kind === 'hide' && (
        <HrDialog title={format(t.hideTitle, { name: dialog.item.name })} onClose={close} busy={busy}>
          <p className="text-sm text-gray-700">{format(t.hideText, { n: dialog.item.positionCount })}</p>
          {error && (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={close} disabled={busy} className={secondaryButton}>
              {t.cancel}
            </button>
            <button type="button" onClick={() => send(() => hrRequest('PATCH', `${base}/${dialog.item.id}`, { isActive: false }))} disabled={busy} className={primaryButton}>
              {busy ? t.saving : t.confirm}
            </button>
          </div>
        </HrDialog>
      )}
    </div>
  );
}
