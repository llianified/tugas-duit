'use client'

function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />
}

const ROW_TITLE_W = ['w-32', 'w-40', 'w-28', 'w-36', 'w-24'] as const

function DataRowSkeleton({
  showDivider,
  titleWidth,
}: {
  showDivider: boolean
  titleWidth: string
}) {
  return (
    <div
      className={[
        'bleed-x flex items-center gap-3 py-[var(--list-row-py)]',
        showDivider ? 'border-b border-border/60' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="min-w-0 flex-1">
        <div className="flex h-5 items-center">
          <Bar className={`h-3.5 ${titleWidth}`} />
        </div>
        <div className="mt-0.5 flex h-4 items-center">
          <Bar className="h-3 w-24" />
        </div>
      </div>
      <Bar className="h-3.5 w-16" />
    </div>
  )
}

export function AppViewSkeleton() {
  return (
    <div className="animate-fade-in view-min-h flex flex-col" aria-hidden>

      <div className="region-under-brand">
        <Bar className="h-12 w-44" />
        <Bar className="stack-gap-t h-3.5 w-24" />

        <div className="mt-[var(--region-gap)] flex gap-2">
          <Bar className="control-h flex-1 rounded-lg" />
          <Bar className="control-h flex-1 rounded-lg" />
        </div>
      </div>

      <div className="region-gap-t">
        <div className="task-card">
          <div className="flex h-7 items-center justify-between gap-3">
            <Bar className="h-5 w-40" />
            <Bar className="h-5 w-16 rounded-full" />
          </div>
          <div className="block-gap-t grid grid-cols-3 gap-1.5">
            {[0, 1, 2].map((column) => (
              <div className="stat-tile" key={column}>
                <div className="flex h-[15px] items-center">
                  <Bar className="h-2.5 w-10" />
                </div>
                <div className="mt-1 flex h-6 items-center">
                  <Bar className="h-4 w-12" />
                </div>
                <div className="flex h-4 items-center">
                  <Bar className="h-2.5 w-10" />
                </div>
              </div>
            ))}
          </div>
          <Bar className="cta-gap cta-h w-full rounded-xl" />
        </div>
      </div>

      <div className="region-t view-trim-b [--view-trim-b:var(--list-row-py)]">
        <div className="flex items-center justify-between gap-3">
          <Bar className="h-3 w-36" />
          <Bar className="h-5 w-16 rounded-full" />
        </div>
        <div className="label-gap-t [--label-trim:var(--list-row-py)] flex flex-col">
          {[0, 1, 2, 3, 4].map((index) => (
            <DataRowSkeleton key={index} showDivider={index !== 4} titleWidth={ROW_TITLE_W[index]} />
          ))}
        </div>
      </div>
    </div>
  )
}
