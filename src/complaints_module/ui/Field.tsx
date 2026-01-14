import type { ReactNode } from 'react';

export function Field({
  label,
  hint,
  error,
  children,
  required = true,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <div className="transition-all duration-300 animate-float-up">
      <div className="flex items-baseline justify-between gap-3">
        <label className="block text-lg font-bold text-slate-900">
          {label}
          {!required && <span className="text-slate-500 font-normal text-base"> (optional)</span>}
        </label>
        {hint && <div className="text-sm text-slate-600 font-semibold">{hint}</div>}
      </div>
      <div className="mt-3">{children}</div>
      {error && (
        <div className="mt-3 text-base text-red-700 font-bold animate-slide-down">
          {error}
        </div>
      )}
    </div>
  );
}
