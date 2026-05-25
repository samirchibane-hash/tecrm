import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const STEPS = [
  { n: 1, label: 'Client' },
  { n: 2, label: 'Assets' },
  { n: 3, label: 'Pages' },
  { n: 4, label: 'Generate' },
  { n: 5, label: 'Vercel' },
  { n: 6, label: 'Domain' },
]

export function ProgressBar({ current }: { current: number }) {
  return (
    <div className="flex items-center mb-8">
      {STEPS.map((step, i) => {
        const done = current > step.n
        const active = current === step.n
        return (
          <div key={step.n} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-all',
                  done && 'bg-primary border-primary text-primary-foreground',
                  active && 'bg-background border-primary text-primary',
                  !done && !active && 'bg-background border-border text-muted-foreground'
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : step.n}
              </div>
              <span
                className={cn(
                  'text-[10px] font-medium whitespace-nowrap',
                  active ? 'text-primary' : done ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  'flex-1 h-px mx-1 mb-4 transition-all',
                  current > step.n ? 'bg-primary' : 'bg-border'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
