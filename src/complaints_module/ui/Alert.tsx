function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function Alert({
  kind,
  title,
  message,
}: {
  kind: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
}) {
  const styles =
    kind === 'success'
      ? 'border-l-4 border-l-emerald-600 bg-emerald-50 text-emerald-900 shadow-md'
      : kind === 'warning'
        ? 'border-l-4 border-l-amber-600 bg-amber-50 text-amber-900 shadow-md'
        : kind === 'error'
          ? 'border-l-4 border-l-red-600 bg-red-50 text-red-900 shadow-md'
          : 'border-l-4 border-l-blue-600 bg-blue-50 text-blue-900 shadow-md';

  const titleStyles =
    kind === 'success'
      ? 'text-emerald-900'
      : kind === 'warning'
        ? 'text-amber-900'
        : kind === 'error'
          ? 'text-red-900'
          : 'text-blue-900';

  return (
    <div className={cx('rounded-lg px-5 py-4 animate-slide-up transition-all duration-300', styles)} role="alert">
      <div className={cx('text-sm font-semibold', titleStyles)}>{title}</div>
      <div className="mt-1 text-sm leading-relaxed">{message}</div>
    </div>
  );
}
