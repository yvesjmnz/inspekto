function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function StepHeader({
  stepIndex,
  stepCount,
  title,
  description,
}: {
  stepIndex: number;
  stepCount: number;
  title: string;
  description: string;
}) {
  const progressPercent = ((stepIndex + 1) / stepCount) * 100;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <div className="text-xs font-bold text-slate-600 uppercase tracking-widest">Public Complaint Form</div>
          <div className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Submit a Complaint</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold text-slate-700">Step {stepIndex + 1} of {stepCount}</div>
          <div className="text-xs text-slate-500 mt-0.5">{Math.round(progressPercent)}% complete</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="text-sm text-slate-600 leading-relaxed">{description}</div>
      </div>

      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
        <div
          className="bg-gradient-to-r from-slate-900 to-slate-700 h-full rounded-full transition-all duration-500 shadow-md"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}
