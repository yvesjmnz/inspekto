import type { ButtonHTMLAttributes } from 'react';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'md' | 'lg' | 'xl';
};

/**
 * Button
 * Styled to match the SubmitComplaintPage look:
 * - rounded-lg
 * - clear focus rings
 * - subtle shadow
 * - teal primary
 */
export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...rest
}: Props) {
  const base =
    'inline-flex items-center justify-center gap-2 font-medium transition-colors ' +
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white ' +
    'disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const sizing =
    size === 'xl'
      ? 'px-6 py-4 rounded-lg text-lg'
      : size === 'lg'
        ? 'px-5 py-3 rounded-lg text-base'
        : 'px-4 py-2.5 rounded-lg text-sm';

  const styles =
    variant === 'primary'
      ? 'bg-[#1a5f5f] text-white hover:bg-[#164d4d] shadow-sm'
      : variant === 'danger'
        ? 'bg-red-600 text-white hover:bg-red-700 shadow-sm'
        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:text-gray-900';

  return <button {...rest} className={cx(base, sizing, styles, className)} />;
}
