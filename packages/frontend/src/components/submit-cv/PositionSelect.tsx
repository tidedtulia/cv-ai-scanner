'use client';

import type { IPublicPositionSummary } from '@org/shared';
import { useI18n } from '../../i18n/I18nProvider';

interface PositionSelectProps {
  positions: IPublicPositionSummary[];
  value: string;
  onChange: (code: string) => void;
  error?: string;
}

export function PositionSelect({ positions, value, onChange, error }: PositionSelectProps) {
  const { dict } = useI18n();

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="position" className="text-sm font-medium text-gray-700">
        {dict.submit.position} <span className="text-red-500">*</span>
      </label>
      <select
        id="position"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? 'position-error' : undefined}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <option value="">{dict.submit.positionPlaceholder}</option>
        {positions.map((position) => (
          <option key={position.code} value={position.code}>
            {position.title}
          </option>
        ))}
      </select>
      {error && (
        <p id="position-error" className="text-xs text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}
