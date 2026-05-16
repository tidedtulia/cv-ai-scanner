'use client';

import { POSITIONS } from '../../data/positions';

interface PositionSelectProps {
  value: string;
  onChange: (id: string) => void;
  error?: string;
}

export function PositionSelect({ value, onChange, error }: PositionSelectProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="position" className="text-sm font-medium text-gray-700">
        Position <span className="text-red-500">*</span>
      </label>
      <select
        id="position"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <option value="">Select a position</option>
        {POSITIONS.map((pos) => (
          <option key={pos.id} value={pos.id}>
            {pos.title}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
