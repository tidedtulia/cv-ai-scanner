'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { isValidEmail, LOGIN_BLOCK_SECONDS } from '@org/shared';
import { format } from '../../i18n/format';
import { useI18n } from '../../i18n/I18nProvider';
import { clientApi } from '../../lib/client-api';

interface FieldErrors {
  email?: string;
  password?: string;
}

/** Sign-in form of /hr/login (hr-auth AC-9, AC-10). `next` is already checked by safeNextPath. */
export function HrLoginForm({ next, expired }: { next: string; expired: boolean }) {
  const { dict } = useI18n();
  const t = dict.hr.login;
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const validate = (): FieldErrors => {
    const found: FieldErrors = {};
    if (!email.trim()) found.email = t.errors.emailRequired;
    else if (!isValidEmail(email.trim())) found.email = t.errors.emailInvalid;
    if (!password) found.password = t.errors.passwordRequired;
    return found;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    setFormError(null);
    if (found.email || found.password) return;

    setSubmitting(true);
    try {
      const response = await fetch(clientApi.authLogin, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (response.ok) {
        router.replace(next);
        router.refresh();
        return;
      }
      setPassword('');
      if (response.status === 429) {
        const seconds = Number(response.headers.get('Retry-After')) || LOGIN_BLOCK_SECONDS;
        setFormError(format(t.errors.tooManyAttempts, { minutes: Math.max(1, Math.ceil(seconds / 60)) }));
      } else if (response.status === 401) {
        setFormError(t.errors.invalidCredentials);
      } else if (response.status === 400) {
        const body = (await response.json().catch(() => ({}))) as { code?: string };
        if (body.code === 'PASSWORD_REQUIRED') setErrors({ password: t.errors.passwordRequired });
        else setErrors({ email: t.errors.emailInvalid });
      } else {
        setFormError(t.errors.network);
      }
    } catch {
      setPassword('');
      setFormError(t.errors.network);
    }
    setSubmitting(false);
  };

  const inputClass = (invalid: boolean) =>
    `mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
      invalid ? 'border-red-400' : 'border-gray-300'
    }`;

  return (
    <form onSubmit={submit} noValidate className="space-y-4" aria-label={t.heading}>
      {expired && (
        <p role="status" className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t.sessionExpired}
        </p>
      )}
      {formError && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </p>
      )}
      <div>
        <label htmlFor="hr-email" className="block text-sm font-medium text-gray-700">
          {t.email}
        </label>
        <input
          id="hr-email"
          name="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'hr-email-error' : undefined}
          className={inputClass(Boolean(errors.email))}
        />
        {errors.email && (
          <p id="hr-email-error" className="mt-1 text-sm text-red-600">
            {errors.email}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="hr-password" className="block text-sm font-medium text-gray-700">
          {t.password}
        </label>
        <input
          id="hr-password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? 'hr-password-error' : undefined}
          className={inputClass(Boolean(errors.password))}
        />
        {errors.password && (
          <p id="hr-password-error" className="mt-1 text-sm text-red-600">
            {errors.password}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {submitting ? t.submitting : t.submit}
      </button>
    </form>
  );
}
