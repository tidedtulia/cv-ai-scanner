'use client';

const ACCEPTED_TYPES = '.pdf,.doc,.docx';
const ACCEPTED_MIME = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

interface CvUploadFieldProps {
  onChange: (file: File | null) => void;
  error?: string;
}

export function CvUploadField({ onChange, error }: CvUploadFieldProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
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
        accept={ACCEPTED_TYPES}
        onChange={handleChange}
        className="text-sm text-gray-600 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
      />
      <p className="text-xs text-gray-400">Accepted formats: PDF, DOC, DOCX</p>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export { ACCEPTED_MIME };
