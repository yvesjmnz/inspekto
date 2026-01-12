function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function HelpText({
  children,
  type = 'info',
}: {
  children: string;
  type?: 'info' | 'tip' | 'warning';
}) {
  const styles =
    type === 'info'
      ? 'bg-blue-50 border border-blue-200 text-blue-900'
      : type === 'tip'
        ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
        : 'bg-amber-50 border border-amber-200 text-amber-900';

  return (
    <div className={cx('rounded-lg px-4 py-3 text-sm leading-relaxed', styles)}>
      {children}
    </div>
  );
}
