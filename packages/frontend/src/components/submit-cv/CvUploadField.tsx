'use client';

import { useState } from 'react';
import { CV_MAX_FILE_SIZE_MB } from '@org/shared';
import { format } from '../../i18n/format';
import { useI18n } from '../../i18n/I18nProvider';

// PDF only (D2). Check by extension: File.type can be empty on some OSes; the API also checks the content.
export function isAcceptedCvFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.pdf');
}

interface CvUploadFieldProps {
  onChange: (file: File | null) => void;
  error?: string;
}

export function CvUploadField({ onChange, error }: CvUploadFieldProps) {
  const { dict } = useI18n();
  const [fileName, setFileName] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setFileName(file?.name ?? '');
    onChange(file);
  };

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="cv" className="text-sm font-medium text-gray-700">
        {dict.submit.cv} <span className="text-red-500">*</span>
      </label>
      <input
        id="cv"
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleChange}
        aria-invalid={!!error}
        aria-describedby={error ? 'cv-error' : undefined}
        className="text-sm text-gray-600 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
      />
      {fileName && <p className="text-xs text-gray-600">{format(dict.submit.cvSelected, { name: fileName })}</p>}
      <p className="text-xs text-gray-400">{format(dict.submit.cvHint, { maxMb: CV_MAX_FILE_SIZE_MB })}</p>
      {error && (
        <p id="cv-error" className="text-xs text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}
