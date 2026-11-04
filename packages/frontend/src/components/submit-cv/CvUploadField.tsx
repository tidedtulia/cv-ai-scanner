'use client';

import { useState } from 'react';
import { CV_MAX_FILE_SIZE_MB } from '@org/shared';

const ACCEPTED_EXTENSIONS = ['.pdf', '.doc', '.docx'];

// Check by extension: File.type is empty for .doc/.docx on some OSes (e.g. Windows without Office)
export function isAcceptedCvFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

interface CvUploadFieldProps {
  onChange: (file: File | null) => void;
  error?: string;
}

export function CvUploadField({ onChange, error }: CvUploadFieldProps) {
  const [fileName, setFileName] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setFileName(file?.name ?? '');
    onChange(file);
  };

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="cv" className="text-sm font-medium text-gray-700">
        Upload CV <span className="text-red-500">*</span>
      </label>
      <input
        id="cv"
        type="file"
        accept={ACCEPTED_EXTENSIONS.join(',')}
        onChange={handleChange}
        aria-invalid={!!error}
        aria-describedby={error ? 'cv-error' : undefined}
        className="text-sm text-gray-600 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
      />
      {fileName && <p className="text-xs text-gray-600">Selected: {fileName}</p>}
      <p className="text-xs text-gray-400">Accepted formats: PDF, DOC, DOCX (max {CV_MAX_FILE_SIZE_MB}MB)</p>
      {error && (
        <p id="cv-error" className="text-xs text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}
