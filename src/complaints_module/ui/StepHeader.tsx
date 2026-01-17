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
        'flex h-9 w-9 items-center justify-center rounded-full border text-sm font-medium transition-colors',
        isActive
          ? 'bg-blue-600 text-white border-blue-600'
          : isComplete
            ? 'bg-blue-50 text-blue-700 border-blue-200'
            : 'bg-white text-gray-500 border-gray-200'
      )}
      aria-current={isActive ? 'step' : undefined}
    >
      {number}
    </div>
  );
}

/**
 * StepHeader
 * Aligns with SubmitComplaintPage.tsx: flatter, rounded-lg, gray borders.
 */
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
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-6 py-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">Public Complaint Form</div>
            <div className="mt-2 text-2xl sm:text-3xl font-semibold text-gray-900">Submit a Complaint</div>
            <div className="mt-1 text-sm text-gray-600">Step {current} of {stepCount}</div>
          </div>
          <div className="text-left sm:text-right">
            <div className="text-sm font-medium text-gray-900">{title}</div>
            {description ? <div className="mt-1 text-sm text-gray-600">{description}</div> : null}
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3 overflow-x-auto py-1">
          {Array.from({ length: stepCount }).map((_, i) => {
            const n = i + 1;
            return (
              <div key={n} className="flex items-center gap-3">
                <StepPill number={n} isActive={n === current} isComplete={n < current} />
                {n < stepCount && (
                  <div
                    className={cx('h-[2px] w-10 rounded-full', n < current ? 'bg-blue-300' : 'bg-gray-200')}
                    aria-hidden="true"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
