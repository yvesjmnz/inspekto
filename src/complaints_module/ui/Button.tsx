import type { ButtonHTMLAttributes } from 'react';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'md' | 'lg' | 'xl';
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...rest
}: Props) {
  const base =
    'inline-flex items-center justify-center gap-2 font-semibold tracking-tight transition-all duration-200 ' +
    'focus:outline-none focus:ring-4 focus:ring-slate-200 disabled:opacity-50 disabled:cursor-not-allowed select-none ' +
    'active:scale-[0.99] active:translate-y-[0.5px] disabled:active:translate-y-0 disabled:active:scale-100 ' +
    'min-h-12';

  const sizing =
    size === 'xl'
      ? 'px-8 py-4 rounded-2xl text-lg sm:text-xl font-bold'
      : size === 'lg'
        ? 'px-7 py-3.5 rounded-xl text-base sm:text-lg'
        : 'px-6 py-3 rounded-xl text-base';

  const styles =
    variant === 'primary'
      ? 'bg-slate-900 text-white border border-slate-900/10 shadow-sm hover:bg-slate-800 hover:shadow-md'
      : variant === 'danger'
        ? 'bg-red-600 text-white border border-red-700/20 shadow-sm hover:bg-red-500 hover:shadow-md'
        : 'bg-white text-slate-900 border border-slate-300 shadow-sm hover:bg-slate-50 hover:border-slate-400 hover:shadow-md';

  return <button {...rest} className={cx(base, sizing, styles, className)} />;
}
