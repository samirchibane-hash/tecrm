import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { LayoutTemplate, FileText, CalendarDays, Sparkles, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FunnelFormData, PageConfig, PageType } from '@/lib/funnel-studio/types'
import { generateCopy } from '@/lib/funnel-studio/api'

interface Props {
  data: FunnelFormData
  onChange: (pages: PageConfig[]) => void
  onNext: (aiCopy?: Record<string, Record<string, unknown>>) => void
  onBack: () => void
}

const PAGE_TYPES: { type: PageType; label: string; desc: string; icon: React.ReactNode }[] = [
  {
    type: 'landing-1',
    label: 'Landing Page 1',
    desc: 'Full-featured primary landing — hero, problem/solution, offer, steps, reviews, FAQ',
    icon: <LayoutTemplate className="h-4 w-4" />,
  },
  {
    type: 'landing-2',
    label: 'Landing Page 2',
    desc: 'Shorter secondary variant — good for a different angle or A/B test',
    icon: <FileText className="h-4 w-4" />,
  },
  {
    type: 'schedule',
    label: 'Schedule / Booking Page',
    desc: 'Calendar embed page with urgency, what to expect, and mini reviews',
    icon: <CalendarDays className="h-4 w-4" />,
  },
]

export function Step3Pages({ data, onChange, onNext, onBack }: Props) {
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiCopy, setAiCopy] = useState<Record<string, Record<string, unknown>> | undefined>()
  const [aiDone, setAiDone] = useState(false)

  const pages = data.pages || []

  function togglePage(type: PageType) {
    const exists = pages.find(p => p.type === type)
    if (exists) {
      onChange(pages.filter(p => p.type !== type))
    } else {
      const city = data.city?.toLowerCase().replace(/\s+/g, '-') || 'city'
      const idx = pages.filter(p => p.type !== 'schedule').length + 1
      const slug = type === 'schedule' ? 'schedule' : `${city}-${idx}`
      onChange([...pages, { type, slug, geoLabel: data.city || '' }])
    }
  }

  function updateSlug(type: PageType, slug: string) {
    onChange(pages.map(p => p.type === type ? { ...p, slug } : p))
  }

  async function handleGenerateAI() {
    const landingPages = pages.filter(p => p.type !== 'schedule')
    if (!landingPages.length) return
    setAiLoading(true)
    setAiError('')
    try {
      const copy = await generateCopy(data, landingPages)
      setAiCopy(copy)
      setAiDone(true)
    } catch (e) {
      setAiError(String(e))
    } finally {
      setAiLoading(false)
    }
  }

  const hasLandingPages = pages.some(p => p.type !== 'schedule')
  const valid = pages.length > 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Page Selection</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Choose which pages to generate for this client.</p>
      </div>

      <div className="space-y-2.5">
        {PAGE_TYPES.map(pt => {
          const selected = pages.find(p => p.type === pt.type)
          return (
            <div
              key={pt.type}
              className={cn(
                'border rounded-xl p-4 cursor-pointer transition-all',
                selected
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/40 hover:bg-muted/20'
              )}
              onClick={() => togglePage(pt.type)}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                    selected ? 'border-primary bg-primary' : 'border-border'
                  )}
                >
                  {selected && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cn('text-muted-foreground', selected && 'text-primary')}>
                      {pt.icon}
                    </span>
                    <span className="font-medium text-sm text-foreground">{pt.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{pt.desc}</p>
                  {selected && pt.type !== 'schedule' && (
                    <div className="mt-3" onClick={e => e.stopPropagation()}>
                      <p className="text-xs font-medium text-muted-foreground mb-1">URL Slug</p>
                      <Input
                        value={selected.slug}
                        onChange={e => updateSlug(pt.type, e.target.value)}
                        className="h-8 text-xs font-mono w-44"
                        placeholder="city-1"
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">e.g. tempe-1, tucson-2</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {hasLandingPages && (
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="flex-1">
              <h3 className="font-medium text-sm text-foreground">AI Copy Generation</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Let Claude write geo-specific headlines, problem/solution copy, reviews, and FAQs
                tailored to <strong>{data.city}, {data.state}</strong>.
              </p>
              {aiDone ? (
                <div className="mt-2.5 flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
                  <Check className="h-3.5 w-3.5" />
                  AI copy generated — will be used when building pages
                  <button
                    onClick={() => { setAiDone(false); setAiCopy(undefined) }}
                    className="ml-1 text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2.5 gap-1.5 text-xs h-8"
                  onClick={handleGenerateAI}
                  disabled={aiLoading}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {aiLoading ? 'Generating…' : 'Generate Copy with AI'}
                </Button>
              )}
              {aiError && <p className="text-destructive text-xs mt-2">{aiError}</p>}
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack}>Back</Button>
        <Button onClick={() => onNext(aiCopy)} disabled={!valid}>
          Next: Review & Generate
        </Button>
      </div>
    </div>
  )
}
