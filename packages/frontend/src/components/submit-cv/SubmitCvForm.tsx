'use client';

import { useState } from 'react';
import { CvUploadField, ACCEPTED_MIME } from './CvUploadField';
import { PositionRequirements } from './PositionRequirements';
import { PositionSelect } from './PositionSelect';

interface FormErrors {
  name?: string;
  email?: string;
  position?: string;
  cv?: string;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function SubmitCvForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [positionId, setPositionId] = useState('');
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const validate = (): FormErrors => {
    const errs: FormErrors = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (!email.trim()) {
      errs.email = 'Email is required';
    } else if (!isValidEmail(email)) {
      errs.email = 'Invalid email address';
    }
    if (!positionId) errs.position = 'Please select a position';
    if (!cvFile) {
      errs.cv = 'Please upload your CV';
    } else if (!ACCEPTED_MIME.includes(cvFile.type)) {
      errs.cv = 'Only PDF, DOC, DOCX files are accepted';
    }
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);

    const formData = new FormData();
    formData.append('name', name);
    formData.append('email', email);
    formData.append('position', positionId);
    formData.append('cv', cvFile as File);

    try {
      const res = await fetch('/api/submit-cv', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
      }
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-6 py-8 text-center">
        <p className="text-lg font-semibold text-green-700">Submit CV successfully</p>
        <p className="mt-1 text-sm text-green-600">We will review your application and get back to you soon.</p>
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
          onChange={(e) => setName(e.target.value)}
          placeholder="Your full name"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-gray-700">
          Email <span className="text-red-500">*</span>
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <PositionSelect value={positionId} onChange={setPositionId} error={errors.position} />
        {positionId && <PositionRequirements positionId={positionId} />}
      </div>

      <CvUploadField onChange={setCvFile} error={errors.cv} />

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
