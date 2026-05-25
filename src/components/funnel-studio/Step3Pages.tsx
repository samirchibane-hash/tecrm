import { useState, useEffect } from 'react'
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

const LOADING_PHASES = [
  { label: 'Analyzing local market…', sub: 'Researching water quality concerns and homeowner pain points' },
  { label: 'Writing hero headlines…', sub: 'Crafting punchy, geo-specific headlines for your market' },
  { label: 'Building problem & solution sections…', sub: 'Positioning the offer against local water issues' },
  { label: 'Generating reviews & FAQs…', sub: 'Creating authentic local testimonials and objection handling' },
  { label: 'Polishing final copy…', sub: 'Reviewing tone, urgency, and conversion flow' },
]

export function Step3Pages({ data, onChange, onNext, onBack }: Props) {
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiCopy, setAiCopy] = useState<Record<string, Record<string, unknown>> | undefined>()
  const [aiDone, setAiDone] = useState(false)
  const [loadingPhase, setLoadingPhase] = useState(0)
  const [loadingProgress, setLoadingProgress] = useState(0)

  useEffect(() => {
    if (!aiLoading) {
      setLoadingPhase(0)
      setLoadingProgress(0)
      return
    }
    setLoadingProgress(4)
    const phaseTimer = setInterval(() => {
      setLoadingPhase(p => Math.min(p + 1, LOADING_PHASES.length - 1))
    }, 8000)
    const progressTimer = setInterval(() => {
      setLoadingProgress(p => Math.min(p + 1.2, 88))
    }, 500)
    return () => {
      clearInterval(phaseTimer)
      clearInterval(progressTimer)
    }
  }, [aiLoading])

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
        <div className={cn(
          'rounded-xl border p-4 transition-colors duration-300',
          aiLoading ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/30'
        )}>
          <div className="flex items-start gap-3">
            <Sparkles className={cn('h-4 w-4 mt-0.5 shrink-0 transition-colors', aiLoading ? 'text-primary animate-pulse' : 'text-primary')} />
            <div className="flex-1">
              <h3 className="font-medium text-sm text-foreground">AI Copy Generation</h3>

              {!aiLoading && !aiDone && (
                <>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Let Claude write geo-specific headlines, problem/solution copy, reviews, and FAQs
                    tailored to <strong>{data.city}, {data.state}</strong>.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2.5 gap-1.5 text-xs h-8"
                    onClick={handleGenerateAI}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Generate Copy with AI
                  </Button>
                </>
              )}

              {aiLoading && (
                <div className="mt-3 space-y-3">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-foreground leading-snug">
                      {LOADING_PHASES[loadingPhase].label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {LOADING_PHASES[loadingPhase].sub}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                        style={{ width: `${loadingProgress}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground text-right tabular-nums">
                      {Math.round(loadingProgress)}%
                    </p>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    This usually takes 20–40 seconds for {pages.filter(p => p.type !== 'schedule').length > 1 ? `${pages.filter(p => p.type !== 'schedule').length} pages` : 'one page'}.
                  </p>
                </div>
              )}

              {aiDone && (
                <div className="mt-2.5 flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
                  <Check className="h-3.5 w-3.5" />
                  AI copy ready — will be used when building pages
                  <button
                    onClick={() => { setAiDone(false); setAiCopy(undefined) }}
                    className="ml-1 text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Redo
                  </button>
                </div>
              )}

              {aiError && (
                <p className="text-destructive text-xs mt-2 break-words">{aiError}</p>
              )}
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
