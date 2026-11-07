'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import {
  MIN_YEARS_MAX,
  POSITION_DESCRIPTION_MAX_LENGTH,
  POSITION_TITLE_MAX_LENGTH,
  positionCodeFromTitle,
  type IHrCatalogItem,
  type IHrPositionDetail,
} from '@org/shared';
import { format } from '../../i18n/format';
import { useI18n } from '../../i18n/I18nProvider';
import { positionErrorMessage } from '../../lib/hr-errors';
import { hrRequest, HrSessionExpiredError } from '../../lib/hr-client';
import { inputClass, primaryButton } from './HrDialog';

type Errors = Partial<Record<'title' | 'category' | 'level' | 'years' | 'description' | 'code', string>>;

/** Create / edit a job (hr-positions AC-2, AC-4, AC-14). The code is only typed when creating. */
export function PositionForm({ categories, levels, job }: { categories: IHrCatalogItem[]; levels: IHrCatalogItem[]; job?: IHrPositionDetail }) {
  const { dict } = useI18n();
  const t = dict.hrPositions;
  const router = useRouter();
  const [title, setTitle] = useState(job?.title ?? '');
  const [categoryCode, setCategoryCode] = useState(job?.category.code ?? '');
  const [levelCode, setLevelCode] = useState(job?.level.code ?? '');
  const [years, setYears] = useState(String(job?.minYearsExperience ?? 0));
  const [description, setDescription] = useState(job?.description ?? '');
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const message = (key: string) => positionErrorMessage(dict, key);

  /** Shown choices, plus the one the job already has even if it was hidden since */
  const options = (items: IHrCatalogItem[], current?: { code: string; name: string }) => {
    const shown = items.filter((item) => item.isActive);
    return current && !shown.some((item) => item.code === current.code) ? [...shown, { code: current.code, name: `${current.name} ${t.form.hidden}` }] : shown;
  };

  const validate = (): Errors => {
    const found: Errors = {};
    if (!title.trim()) found.title = message('TITLE_REQUIRED');
    else if (title.trim().length > POSITION_TITLE_MAX_LENGTH) found.title = message('TITLE_TOO_LONG');
    if (!categoryCode) found.category = message('CATEGORY_INVALID');
    if (!levelCode) found.level = message('LEVEL_INVALID');
    const n = Number(years);
    if (years.trim() === '' || !Number.isInteger(n) || n < 0 || n > MIN_YEARS_MAX) found.years = message('YEARS_INVALID');
    if (!description.trim()) found.description = message('DESCRIPTION_REQUIRED');
    else if (description.trim().length > POSITION_DESCRIPTION_MAX_LENGTH) found.description = message('DESCRIPTION_TOO_LONG');
    return found;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    setFormError(null);
    setNotice(null);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      const data = { title, categoryCode, levelCode, minYearsExperience: Number(years), description, ...(job || !code.trim() ? {} : { code: code.trim() }) };
      const result = await hrRequest<IHrPositionDetail>(job ? 'PATCH' : 'POST', job ? `/api/hr/positions/${job.id}` : '/api/hr/positions', data);
      if (!result.ok) {
        const text = message(result.body.code ?? '');
        if (result.body.code === 'CODE_TAKEN' || result.body.code === 'CODE_INVALID') setErrors({ code: text });
        else setFormError(text);
      } else if (job) {
        setNotice(t.form.saved);
        router.refresh();
      } else {
        router.replace(`/hr/positions/${result.body.id}`);
        router.refresh();
        return;
      }
    } catch (cause) {
      if (!(cause instanceof HrSessionExpiredError)) setFormError(t.genericError);
    }
    setSaving(false);
  };

  const field = (name: keyof Errors) => ({ 'aria-invalid': Boolean(errors[name]), 'aria-describedby': errors[name] ? `job-${name}-error` : undefined });
  const error = (name: keyof Errors) =>
    errors[name] && (
      <p id={`job-${name}-error`} className="mt-1 text-sm text-red-600">
        {errors[name]}
      </p>
    );

  return (
    <form onSubmit={submit} noValidate aria-label={job ? t.form.editTitle : t.form.createTitle} className="space-y-4">
      {formError && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">
          {notice}
        </p>
      )}
      <label className="block text-sm font-medium text-gray-700">
        {t.form.title}
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={POSITION_TITLE_MAX_LENGTH + 1} className={inputClass} {...field('title')} />
      </label>
      {error('title')}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t.form.category}
            <select value={categoryCode} onChange={(e) => setCategoryCode(e.target.value)} className={inputClass} {...field('category')}>
              <option value="">{t.form.choose}</option>
              {options(categories, job?.category).map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          {error('category')}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t.form.level}
            <select value={levelCode} onChange={(e) => setLevelCode(e.target.value)} className={inputClass} {...field('level')}>
              <option value="">{t.form.choose}</option>
              {options(levels, job?.level).map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          {error('level')}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t.form.years}
            <input type="number" min={0} max={MIN_YEARS_MAX} step={1} value={years} onChange={(e) => setYears(e.target.value)} className={inputClass} {...field('years')} />
          </label>
          {error('years')}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">
          {t.form.description}
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={12} className={`${inputClass} font-mono`} {...field('description')} />
        </label>
        <p className="mt-1 text-right text-xs text-gray-500">{format(t.form.descriptionCount, { count: description.length, max: POSITION_DESCRIPTION_MAX_LENGTH })}</p>
        {error('description')}
      </div>
      {job ? (
        <p className="text-sm text-gray-700">
          {t.form.codeFixed}: <code className="rounded bg-gray-100 px-1">{job.code}</code> · {t.form.publicLink}: <code className="rounded bg-gray-100 px-1">/submit-cv?position={job.code}</code>
        </p>
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t.form.code}
            <input value={code} onChange={(e) => setCode(e.target.value)} className={inputClass} {...field('code')} />
          </label>
          <p className="mt-1 text-xs text-gray-500">{format(t.form.codeHint, { code: positionCodeFromTitle(title) || 'job' })}</p>
          {error('code')}
        </div>
      )}
      <button type="submit" disabled={saving} className={primaryButton}>
        {saving ? t.form.saving : job ? t.form.save : t.form.create}
      </button>
    </form>
  );
}
