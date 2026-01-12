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
      <header className="px-6 lg:px-8 py-5 lg:py-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <div className="text-lg lg:text-xl font-semibold tracking-tight text-slate-900">{title}</div>
        {subtitle && <div className="mt-1 text-sm lg:text-base text-slate-600 leading-relaxed">{subtitle}</div>}
      </header>
      <div className="px-6 lg:px-8 py-6 lg:py-7">{children}</div>
    </section>
  );
}
