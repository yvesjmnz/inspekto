import type { ReactNode } from 'react';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

/**
 * Panel
 * Matches SubmitComplaintPage.tsx design language:
 * - rounded-lg
 * - light border + subtle shadow
 * - clean header
 */
export function Panel({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        'bg-white rounded-lg border border-gray-200 shadow-sm',
        className
      )}
    >
      <header className="px-6 py-5 border-b border-gray-200">
        <div className="text-2xl font-semibold text-gray-900">{title}</div>
        {subtitle && (
          <div className="mt-2 text-sm text-gray-600 leading-relaxed">{subtitle}</div>
        )}
      </header>
      <div className="px-6 py-6">{children}</div>
    </section>
  );
}
