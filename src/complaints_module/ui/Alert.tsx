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
      ? 'border-l-4 border-l-emerald-500 bg-emerald-50 text-emerald-950 shadow-md'
      : kind === 'warning'
        ? 'border-l-4 border-l-amber-500 bg-amber-50 text-amber-950 shadow-md'
        : kind === 'error'
          ? 'border-l-4 border-l-red-500 bg-red-50 text-red-950 shadow-md'
          : 'border-l-4 border-l-slate-500 bg-slate-50 text-slate-950 shadow-md';

  return (
    <div className={cx('rounded-lg px-5 py-4 animate-slide-up transition-all duration-300', styles)}>
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-sm leading-relaxed">{message}</div>
    </div>
  );
}
