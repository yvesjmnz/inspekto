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
    'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 ' +
    'focus:outline-none focus:ring-4 focus:ring-slate-300 disabled:opacity-50 disabled:cursor-not-allowed ' +
    'active:scale-[0.99] min-h-14 sm:min-h-12';

  const sizing = 
    size === 'xl' 
      ? 'px-8 py-4 rounded-2xl text-lg sm:text-xl font-bold' 
      : size === 'lg' 
        ? 'px-7 py-3.5 rounded-xl text-base sm:text-lg' 
        : 'px-5 py-3 rounded-lg text-base';

  const styles =
    variant === 'primary'
      ? 'bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-md hover:shadow-lg hover:from-slate-800 hover:to-slate-700'
      : variant === 'danger'
        ? 'bg-gradient-to-r from-red-600 to-red-500 text-white shadow-md hover:shadow-lg hover:from-red-500 hover:to-red-600'
        : 'bg-white text-slate-900 border-2 border-slate-300 shadow-sm hover:shadow-md hover:border-slate-400';

  return <button {...rest} className={cx(base, sizing, styles, className)} />;
}
