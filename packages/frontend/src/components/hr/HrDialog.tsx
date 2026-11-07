'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Modal dialog of the HR area: role="dialog", labelled by its title, focus moves into it and goes back to the
 * element that opened it, Esc closes it (unless `busy`). Used by the job / criteria / catalog screens.
 */
export function HrDialog({ title, onClose, busy = false, children }: { title: string; onClose: () => void; busy?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    opener.current = document.activeElement;
    ref.current?.focus();
    return () => {
      const previous = opener.current as HTMLElement | null;
      setTimeout(() => previous?.focus?.(), 0);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hr-dialog-title"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !busy) onClose();
        }}
        className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-lg bg-white p-6 shadow-xl focus:outline-none"
      >
        <h2 id="hr-dialog-title" className="text-lg font-bold text-gray-900">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

export const dialogButton = 'rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60';
export const primaryButton = `${dialogButton} bg-blue-600 text-white hover:bg-blue-700`;
export const secondaryButton = `${dialogButton} border border-gray-300 text-gray-700 hover:bg-gray-100`;
export const dangerButton = `${dialogButton} bg-red-600 text-white hover:bg-red-700`;
export const inputClass = 'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
