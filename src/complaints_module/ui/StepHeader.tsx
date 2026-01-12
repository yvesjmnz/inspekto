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
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
        <div>
          <div className="text-xs font-bold text-slate-600 uppercase tracking-widest">Public Complaint Form</div>
          <div className="mt-2 text-3xl md:text-4xl font-bold tracking-tight text-slate-900">Submit a Complaint</div>
          <div className="mt-3 text-sm font-medium text-slate-700">Step {stepIndex + 1} of {stepCount}</div>
        </div>

        <div className="max-w-2xl">
          <div className="text-sm font-bold text-slate-900 uppercase tracking-wide">{title}</div>
          <div className="mt-2 text-sm text-slate-600 leading-relaxed hidden md:block">{description}</div>
        </div>
      </div>

      <div className="flex gap-2">
        {Array.from({ length: stepCount }).map((_, idx) => (
          <div
            key={idx}
            className={cx(
              'h-2 flex-1 rounded-full transition-all duration-500',
              idx <= stepIndex 
                ? 'bg-gradient-to-r from-slate-900 to-slate-700 shadow-md' 
                : 'bg-slate-200'
            )}
          />
        ))}
      </div>
    </div>
  );
}
