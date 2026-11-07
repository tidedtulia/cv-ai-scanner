'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  APPLICATION_CONSENT_VALUE,
  APPLICATION_FORM_FIELDS,
  APPLICATION_TEXT_MAX_LENGTH,
  CV_MAX_FILE_SIZE_BYTES,
  isValidEmail,
  type ApplicationErrorResponse,
  type ApplicationMessageCode,
  type IPublicPositionSummary,
} from '@org/shared';
import { useI18n } from '../../i18n/I18nProvider';
import { clientApi } from '../../lib/client-api';
import { CvUploadField, isAcceptedCvFile } from './CvUploadField';
import { PositionDetails } from './PositionDetails';
import { PositionSelect } from './PositionSelect';

/** Errors are kept as codes, so switching language re-renders them in the new language. */
interface FormErrors {
  name?: ApplicationMessageCode;
  email?: ApplicationMessageCode;
  position?: ApplicationMessageCode;
  cv?: ApplicationMessageCode;
  consent?: ApplicationMessageCode;
}

/** `code` → translated message; else the API's own message; else (network, proxy error…) the generic one */
type SubmitError = { code: ApplicationMessageCode } | { message: string } | { generic: true };

interface SubmitCvFormProps {
  positions: IPublicPositionSummary[];
  /** From /submit-cv?position=<code>; '' when absent or not an open position */
  initialPositionCode?: string;
}

export function SubmitCvForm({ positions, initialPositionCode = '' }: SubmitCvFormProps) {
  const { dict, locale } = useI18n();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [positionCode, setPositionCode] = useState(initialPositionCode);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<SubmitError | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const message = (code?: ApplicationMessageCode) => (code ? dict.applicationMessages[code] : undefined);

  const clearError = (field: keyof FormErrors) => {
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  /** Same rules and order as the API (submit-application-api AC-2). */
  const validate = (): FormErrors => {
    const errs: FormErrors = {};
    const trimmedName = name.trim();
    if (!trimmedName) errs.name = 'NAME_REQUIRED';
    else if (trimmedName.length > APPLICATION_TEXT_MAX_LENGTH) errs.name = 'NAME_TOO_LONG';
    if (!email.trim()) {
      errs.email = 'EMAIL_REQUIRED';
    } else if (!isValidEmail(email.trim())) {
      errs.email = 'EMAIL_INVALID';
    }
    if (!positionCode) errs.position = 'POSITION_REQUIRED';
    if (!cvFile) {
      errs.cv = 'CV_REQUIRED';
    } else if (!isAcceptedCvFile(cvFile)) {
      errs.cv = 'CV_NOT_PDF';
    } else if (cvFile.size > CV_MAX_FILE_SIZE_BYTES) {
      errs.cv = 'CV_TOO_LARGE';
    }
    if (!consent) errs.consent = 'CONSENT_REQUIRED';
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);

    const formData = new FormData();
    formData.append(APPLICATION_FORM_FIELDS.NAME, name.trim());
    formData.append(APPLICATION_FORM_FIELDS.EMAIL, email.trim());
    formData.append(APPLICATION_FORM_FIELDS.POSITION, positionCode);
    formData.append(APPLICATION_FORM_FIELDS.CV, cvFile as File);
    formData.append(APPLICATION_FORM_FIELDS.CONSENT, APPLICATION_CONSENT_VALUE);
    // The result email is sent in this language (result-email AC-1)
    formData.append(APPLICATION_FORM_FIELDS.LOCALE, locale);

    try {
      const res = await fetch(clientApi.applications, { method: 'POST', body: formData });
      if (res.ok) {
        setSubmitted(true);
        return;
      }
      const data = (await res.json().catch(() => null)) as Partial<ApplicationErrorResponse> | null;
      if (data?.code && data.code in dict.applicationMessages) {
        setSubmitError({ code: data.code });
      } else if (typeof data?.message === 'string') {
        setSubmitError({ message: data.message });
      } else {
        setSubmitError({ generic: true });
      }
    } catch {
      setSubmitError({ generic: true });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-6 py-8 text-center">
        <p className="text-lg font-semibold text-green-700">{dict.applicationMessages.SUBMITTED}</p>
        <p className="mt-1 text-sm text-green-600">{dict.submit.successText}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            {dict.submit.backHome}
          </Link>
          <Link href="/jobs" className="rounded-md px-4 py-2 text-sm font-semibold text-blue-700 ring-1 ring-blue-200 hover:bg-blue-50">
            {dict.submit.otherJobs}
          </Link>
        </div>
      </div>
    );
  }

  const inputClass =
    'rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium text-gray-700">
          {dict.submit.name} <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            clearError('name');
          }}
          placeholder={dict.submit.namePlaceholder}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'name-error' : undefined}
          className={inputClass}
        />
        {errors.name && (
          <p id="name-error" className="text-xs text-red-500">
            {message(errors.name)}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-gray-700">
          {dict.submit.email} <span className="text-red-500">*</span>
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clearError('email');
          }}
          placeholder={dict.submit.emailPlaceholder}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
          className={inputClass}
        />
        {errors.email && (
          <p id="email-error" className="text-xs text-red-500">
            {message(errors.email)}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <PositionSelect
          positions={positions}
          value={positionCode}
          onChange={(code) => {
            setPositionCode(code);
            clearError('position');
          }}
          error={message(errors.position)}
        />
        {positionCode && <PositionDetails code={positionCode} />}
      </div>

      <CvUploadField
        onChange={(file) => {
          setCvFile(file);
          clearError('cv');
        }}
        error={message(errors.cv)}
      />

      <div className="flex flex-col gap-1">
        <div className="flex items-start gap-2">
          <input
            id="consent"
            type="checkbox"
            checked={consent}
            onChange={(e) => {
              setConsent(e.target.checked);
              clearError('consent');
            }}
            aria-invalid={!!errors.consent}
            aria-describedby={errors.consent ? 'consent-error' : undefined}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="consent" className="text-sm text-gray-700">
            {dict.submit.consentBefore}
            <Link href="/privacy" target="_blank" className="font-medium text-blue-600 underline">
              {dict.submit.consentLink}
            </Link>
            {dict.submit.consentAfter} <span className="text-red-500">*</span>
          </label>
        </div>
        {errors.consent && (
          <p id="consent-error" className="text-xs text-red-500">
            {message(errors.consent)}
          </p>
        )}
      </div>

      {submitError && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {'code' in submitError
            ? dict.applicationMessages[submitError.code]
            : 'message' in submitError
              ? submitError.message
              : dict.submit.genericError}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? dict.submit.submitting : dict.submit.submit}
      </button>
    </form>
  );
}
