function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

/**
 * Alert
 * Styled closer to SubmitComplaintPage.tsx:
 * - rounded-lg
 * - light background + border
 * - simple typography
 */
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
      ? 'bg-green-50 border border-green-200 text-green-900'
      : kind === 'warning'
        ? 'bg-amber-50 border border-amber-200 text-amber-900'
        : kind === 'error'
          ? 'bg-red-50 border border-red-200 text-red-900'
          : 'bg-blue-50 border border-blue-200 text-blue-900';

  return (
    <div className={cx('rounded-lg p-4 flex items-start gap-3', styles)} role="alert">
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="mt-1 text-sm opacity-90 leading-relaxed">{message}</div>
      </div>
    </div>
  );
}
