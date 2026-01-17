import type { ReactNode } from 'react';

/**
 * Field
 * Matches SubmitComplaintPage.tsx design language:
 * - uppercase label
 * - smaller helper text
 * - simple error presentation
 */
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
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label className="block text-sm font-medium text-gray-700 uppercase tracking-wide">
          {label}
          {!required && <span className="text-gray-500 font-normal normal-case"> (optional)</span>}
        </label>
        {hint && <div className="text-xs text-gray-500">{hint}</div>}
      </div>

      <div className="mt-2">{children}</div>

      {error && (
        <div className="mt-2 text-sm text-red-700 font-medium">{error}</div>
      )}
    </div>
  );
}
