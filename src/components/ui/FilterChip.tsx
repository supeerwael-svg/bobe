import type { ReactNode } from 'react';

interface FilterChipProps {
  label: ReactNode;
  active: boolean;
  onClick: () => void;
}

export function FilterChip({ label, active, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-medium ring-1 transition duration-200 ${
        active ? 'bg-primary-600 text-white ring-primary-600' : 'bg-white text-neutral-700 ring-neutral-300 hover:bg-neutral-50'
      }`}
    >
      {label}
    </button>
  );
}
