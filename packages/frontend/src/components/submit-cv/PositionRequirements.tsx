import { POSITIONS } from '../../data/positions';

interface PositionRequirementsProps {
  positionId: string;
}

export function PositionRequirements({ positionId }: PositionRequirementsProps) {
  const position = POSITIONS.find((p) => p.id === positionId);

  if (!position) return null;

  return (
    <div className="rounded-md border border-blue-100 bg-blue-50 px-4 py-3">
      <p className="mb-2 text-sm font-semibold text-blue-800">Requirements for {position.title}:</p>
      <ul className="list-inside list-disc space-y-1">
        {position.requirements.map((req) => (
          <li key={req} className="text-sm text-blue-700">
            {req}
          </li>
        ))}
      </ul>
    </div>
  );
}
