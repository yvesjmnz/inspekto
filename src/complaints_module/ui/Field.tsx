import type { ReactNode } from 'react';

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="transition-all duration-200">
      <div className="flex items-baseline justify-between gap-3">
        <label className="block text-sm font-semibold text-slate-800">{label}</label>
        {hint && <div className="text-xs text-slate-500 font-medium">{hint}</div>}
      </div>
      <div className="mt-2.5">{children}</div>
      {error && (
        <div className="mt-2 text-sm text-red-700 font-semibold animate-slide-down">
          {error}
        </div>
      )}
    </div>
  );
}
