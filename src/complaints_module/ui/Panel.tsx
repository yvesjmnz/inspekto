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
        'bg-white border border-slate-200 rounded-3xl shadow-md',
        'transition-shadow duration-200 hover:shadow-lg hover:border-slate-300',
        className
      )}
    >
      <header className="px-8 lg:px-10 py-7 lg:py-8 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <div className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900">{title}</div>
        {subtitle && <div className="mt-2 text-base lg:text-lg text-slate-700 leading-relaxed font-medium">{subtitle}</div>}
      </header>
      <div className="px-8 lg:px-10 py-8 lg:py-9">{children}</div>
    </section>
  );
}
