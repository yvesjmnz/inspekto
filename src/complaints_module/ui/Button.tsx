import type { ButtonHTMLAttributes } from 'react';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'md' | 'lg';
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...rest
}: Props) {
  const base =
    'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 ' +
    'focus:outline-none focus:ring-4 focus:ring-slate-200 disabled:opacity-50 disabled:cursor-not-allowed ' +
    'transform hover:scale-105 active:scale-95';

  const sizing = size === 'lg' ? 'px-6 py-3.5 rounded-xl text-sm' : 'px-4 py-2.5 rounded-lg text-sm';

  const styles =
    variant === 'primary'
      ? 'bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-lg hover:shadow-xl hover:from-slate-800 hover:to-slate-700 active:shadow-md'
      : variant === 'danger'
        ? 'bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg hover:shadow-xl hover:from-red-500 hover:to-red-600 active:shadow-md'
        : 'bg-white text-slate-900 border-2 border-slate-300 shadow-sm hover:shadow-md hover:border-slate-400 active:shadow-none';

  return <button {...rest} className={cx(base, sizing, styles, className)} />;
}
