'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CV_MAX_FILE_SIZE_BYTES, CV_MAX_FILE_SIZE_MB, isValidEmail } from '@org/shared';
import { CvUploadField, isAcceptedCvFile } from './CvUploadField';
import { PositionRequirements } from './PositionRequirements';
import { PositionSelect } from './PositionSelect';

interface FormErrors {
  name?: string;
  email?: string;
  position?: string;
  cv?: string;
}

const SUBMIT_ERROR_MESSAGE = 'Failed to submit CV. Please try again.';

export function SubmitCvForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [positionId, setPositionId] = useState('');
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const clearError = (field: keyof FormErrors) => {
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = (): FormErrors => {
    const errs: FormErrors = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (!email.trim()) {
      errs.email = 'Email is required';
    } else if (!isValidEmail(email.trim())) {
      errs.email = 'Invalid email address';
    }
    if (!positionId) errs.position = 'Please select a position';
    if (!cvFile) {
      errs.cv = 'Please upload your CV';
    } else if (!isAcceptedCvFile(cvFile)) {
      errs.cv = 'Only PDF, DOC, DOCX files are accepted';
    } else if (cvFile.size > CV_MAX_FILE_SIZE_BYTES) {
      errs.cv = `File size must not exceed ${CV_MAX_FILE_SIZE_MB}MB`;
    }
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);

    const formData = new FormData();
    formData.append('name', name.trim());
    formData.append('email', email.trim());
    formData.append('position', positionId);
    formData.append('cv', cvFile as File);

    try {
      const res = await fetch('/api/submit-cv', { method: 'POST', body: formData });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setSubmitted(true);
      } else {
        setSubmitError(data?.message || SUBMIT_ERROR_MESSAGE);
      }
    } catch {
      setSubmitError(SUBMIT_ERROR_MESSAGE);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-6 py-8 text-center">
        <p className="text-lg font-semibold text-green-700">Submit CV successfully</p>
        <p className="mt-1 text-sm text-green-600">We will review your application and get back to you soon.</p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium text-gray-700">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            clearError('name');
          }}
          placeholder="Your full name"
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'name-error' : undefined}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {errors.name && (
          <p id="name-error" className="text-xs text-red-500">
            {errors.name}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-gray-700">
          Email <span className="text-red-500">*</span>
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clearError('email');
          }}
          placeholder="you@example.com"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {errors.email && (
          <p id="email-error" className="text-xs text-red-500">
            {errors.email}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <PositionSelect
          value={positionId}
          onChange={(id) => {
            setPositionId(id);
            clearError('position');
          }}
          error={errors.position}
        />
        {positionId && <PositionRequirements positionId={positionId} />}
      </div>

      <CvUploadField
        onChange={(file) => {
          setCvFile(file);
          clearError('cv');
        }}
        error={errors.cv}
      />

      {submitError && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {submitError}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Submitting...' : 'Submit CV'}
      </button>
    </form>
  );
}
