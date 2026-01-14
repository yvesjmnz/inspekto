function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function StepPill({
  number,
  isActive,
  isComplete,
}: {
  number: number;
  isActive: boolean;
  isComplete: boolean;
}) {
  return (
    <div
      className={cx(
        'flex h-10 w-10 items-center justify-center rounded-full border text-sm font-bold transition-colors',
        isActive
          ? 'bg-blue-600 text-white border-blue-600'
          : isComplete
            ? 'bg-blue-50 text-blue-700 border-blue-200'
            : 'bg-white text-slate-500 border-slate-200'
      )}
      aria-current={isActive ? 'step' : undefined}
    >
      {number}
    </div>
  );
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
  const current = stepIndex + 1;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white px-8 py-7">
        <div className="text-center">
          <div className="text-xs font-bold uppercase tracking-widest text-blue-700">Public Complaint Form</div>
          <div className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">Submit a Complaint</div>
          <div className="mt-2 text-sm font-semibold text-slate-700">Step {current} of {stepCount}</div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-3 overflow-x-auto py-1">
          {Array.from({ length: stepCount }).map((_, i) => {
            const n = i + 1;
            return (
              <div key={n} className="flex items-center gap-3">
                <StepPill number={n} isActive={n === current} isComplete={n < current} />
                {n < stepCount && (
                  <div
                    className={cx(
                      'h-[2px] w-10 rounded-full',
                      n < current ? 'bg-blue-300' : 'bg-slate-200'
                    )}
                    aria-hidden="true"
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 text-center">
          <div className="text-xl font-bold text-slate-900">{title}</div>
        </div>
      </div>
    </div>
  );
}
