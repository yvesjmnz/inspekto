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
    <div className="space-y-6 animate-fade-in-slow">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6">
        <div className="animate-float-up">
          <div className="text-sm font-bold text-slate-600 uppercase tracking-widest">Public Complaint Form</div>
          <div className="mt-2 text-4xl sm:text-5xl font-bold tracking-tight text-slate-900">Submit a Complaint</div>
        </div>
        <div className="text-right animate-rotate-in">
          <div className="text-lg font-bold text-slate-800">Step {stepIndex + 1} of {stepCount}</div>
          <div className="text-base text-slate-600 mt-1 font-semibold">{Math.round(progressPercent)}% complete</div>
        </div>
      </div>

      <div className="space-y-3 animate-slide-up">
        <div className="text-2xl font-bold text-slate-900">{title}</div>
        <div className="text-lg text-slate-700 leading-relaxed font-medium">{description}</div>
      </div>

      <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden shadow-md animate-pulse-glow">
        <div
          className="bg-gradient-to-r from-slate-900 to-slate-700 h-full rounded-full transition-all duration-700 shadow-lg"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}
