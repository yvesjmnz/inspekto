import type { ReactNode } from 'react';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

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
        'bg-white border border-slate-200 rounded-2xl shadow-lg',
        'transition-all duration-300 hover:shadow-xl hover:border-slate-300',
        'animate-scale-in',
        className
      )}
    >
      <header className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <div className="text-base font-semibold tracking-tight text-slate-900">{title}</div>
        {subtitle && <div className="mt-1 text-sm text-slate-600 leading-relaxed">{subtitle}</div>}
      </header>
      <div className="px-6 py-6">{children}</div>
    </section>
  );
}
