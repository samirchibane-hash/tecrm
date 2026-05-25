import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Eye, Github, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FunnelFormData } from '@/lib/funnel-studio/types'
import { generateFunnel, previewPage } from '@/lib/funnel-studio/api'

interface Props {
  data: FunnelFormData
  aiCopy?: Record<string, Record<string, unknown>>
  onSuccess: (commitSha: string) => void
  onBack: () => void
}

function buildPreviewConfig(
  form: FunnelFormData,
  page: { type: string; slug: string },
  overrides?: Record<string, unknown>
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    meta: {
      title: `${form.brandName} | Free Water Test — ${form.city}`,
      description: '',
      pixel_id: form.pixelId || '000000',
      page_slug: page.slug,
      client_slug: form.slug,
    },
    geo: { label: form.city, state: form.state, banner_text: `Serving ${form.city} Homeowners`, banner_emoji: '📍' },
    urgency: { text: 'Limited install slots available this week' },
    hero: { headline: `Stop Bathing Your Family in <em>Contaminated Water</em>`, subhead: `${form.city} tap water contains chlorine and PFAS.` },
    form: { headline: 'See if we service your area:', sub: 'Enter your zip code', button_text: 'Check My Zip →', guarantee_text: 'Free, no-obligation.', next_url: '/schedule', webhook_url: form.webhookUrl },
    social_proof: { google_rating: '4.8', google_review_count: '200+', angi_count: '150+', years_in_business: '10' },
    problem: { headline: `What's Really in Your <em>${form.city}</em> Water`, subhead: `${form.state} water tests positive for PFAS and heavy metals.`, stat_num: '83%', stat_label: `of ${form.state} homes have hard water`, entries: [{ icon: '🧴', title: 'Dry Skin', desc: 'Hard water strips moisture.' }, { icon: '🤢', title: 'Bad Taste', desc: 'Metallic taste from tap water.' }, { icon: '🫀', title: 'Health Risk', desc: 'PFAS accumulates over time.' }, { icon: '🔧', title: 'Scale Damage', desc: 'Destroys appliances.' }] },
    solution: { headline: 'One System. Every Tap.', subhead: `Installed in ${form.city} in one day.`, benefits: [{ title: 'Whole-home purification', sub: 'Every tap covered' }, { title: 'PFAS removal', sub: 'Certified filtration' }, { title: 'Softer skin', sub: 'Day-one difference' }, { title: 'Local installation', sub: 'No subcontractors' }, { title: 'Lifetime warranty', sub: 'We stand behind it' }] },
    offer: { headline: 'Get Your Free Water Test', subhead: 'No pressure.', pills: ['$0 Down', 'Installed in 1 Day', 'Lifetime Warranty', 'Free Kitchen Filter'], cta_text: 'Check My Zip', guarantee: 'Zero pressure.' },
    steps: { headline: '3 Simple Steps', entries: [{ title: 'Check Zip', desc: '60 seconds.' }, { title: 'Free Test', desc: 'Expert visits.' }, { title: 'Installed', desc: 'Same day.' }] },
    reviews: { headline: `What ${form.city} Homeowners Say`, entries: [{ text: 'Amazing service!', author: 'Sarah M.', date: '3 days ago' }, { text: 'Best decision ever.', author: 'James R.', date: '1 week ago' }, { text: 'Highly recommend!', author: 'Maria T.', date: '2 weeks ago' }, { text: 'Professional team.', author: 'David K.', date: '5 days ago' }, { text: 'Great results.', author: 'Lisa P.', date: '1 month ago' }, { text: 'Worth every penny.', author: 'Tom W.', date: '3 weeks ago' }] },
    faq: { headline: 'Everything You\'re Wondering' },
    faqs: [{ question: 'How much does it cost?', answer: '$0 down, finance from $45/mo.' }, { question: 'How long does installation take?', answer: 'One day.' }, { question: 'Is there a warranty?', answer: 'Lifetime parts warranty.' }, { question: 'What does it remove?', answer: 'Chlorine, PFAS, heavy metals.' }, { question: 'How is it different from Brita?', answer: 'Whole-home coverage.' }, { question: "What if my water isn't bad?", answer: 'Free test with no obligation.' }],
    cta: { headline: 'Ready for <em>Clean Water?</em>', subhead: 'Check your zip.', sticky_text: 'Get FREE Water Test →' },
    assets: { logo_url: form.logoBase64 ? `data:image/png;base64,${form.logoBase64}` : '/assets/images/logo.png' },
    footer: { phone: form.phone || '', disclaimer: 'Discounts apply.', copyright_year: '2025', brand: form.brandName, privacy_url: '/privacy', terms_url: '/terms' },
    page: { headline: 'Book your appointment', subhead: 'Pick a time below.', slots_text: 'Limited slots', urgency_items: [{ icon: '✅', text: 'Free test' }, { icon: '⏱', text: '45 minutes' }, { icon: '🚫', text: 'No pressure' }] },
    calendar: { card_headline: 'Choose Your Time', card_sub: 'Select date and time', embed_url: form.calendarEmbedUrl || '', embed_id: 'cal', thank_you_url: '/thank-you' },
    expect: [{ icon: '🧪', title: 'Water test on-site', desc: '10 minutes.' }, { icon: '📋', title: 'Immediate results', desc: 'You see everything.' }, { icon: '💧', title: 'Right system', desc: 'No upsells.' }, { icon: '🏠', title: 'Same-day install', desc: 'If you choose.' }],
  }
  if (overrides) return { ...base, ...overrides }
  return base
}

export function Step4Generate({ data, aiCopy, onSuccess, onBack }: Props) {
  const [previewSlug, setPreviewSlug] = useState<string | null>(null)
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  async function loadPreview(pageIdx: number) {
    const page = data.pages[pageIdx]
    if (!page) return
    setPreviewLoading(true)
    setPreviewSlug(page.slug)
    try {
      const config = buildPreviewConfig(data, page, aiCopy?.[page.slug])
      const html = await previewPage(page.type, config)
      setPreviewHtml(html)
    } catch (e) {
      setPreviewHtml(`<p style="padding:20px;color:red;">Preview error: ${e}</p>`)
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleGenerate() {
    setGenerating(true)
    setError('')
    try {
      const { commitSha } = await generateFunnel(data, aiCopy)
      onSuccess(commitSha)
    } catch (e) {
      setError(String(e))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Review & Generate</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Preview pages, then commit them to GitHub.</p>
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Summary</h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div><span className="text-muted-foreground">Client:</span> <span className="font-medium">{data.clientName}</span></div>
          <div><span className="text-muted-foreground">Slug:</span> <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{data.slug}</code></div>
          <div><span className="text-muted-foreground">Location:</span> <span className="font-medium">{data.city}, {data.state}</span></div>
          <div><span className="text-muted-foreground">Pages:</span> <span className="font-medium">{data.pages.length}</span></div>
          <div>
            <span className="text-muted-foreground">AI Copy:</span>{' '}
            <span className={aiCopy ? 'text-green-600 dark:text-green-400 font-medium' : 'text-muted-foreground'}>
              {aiCopy ? 'Yes' : 'No (using defaults)'}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Logo:</span>{' '}
            <span className={data.logoBase64 ? 'text-green-600 dark:text-green-400 font-medium' : 'text-muted-foreground'}>
              {data.logoBase64 ? 'Uploaded' : 'No logo'}
            </span>
          </div>
        </div>

        <div className="pt-1">
          <p className="text-xs font-medium text-muted-foreground mb-2">Pages to generate — click to preview:</p>
          <div className="flex flex-wrap gap-2">
            {data.pages.map((p, i) => (
              <button
                key={p.slug}
                onClick={() => loadPreview(i)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                  previewSlug === p.slug
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-foreground border-border hover:border-primary/50'
                )}
              >
                <Eye className="h-3 w-3" />
                {p.slug}
              </button>
            ))}
          </div>
        </div>
      </div>

      {previewSlug && (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="bg-muted/40 px-4 py-2 flex items-center justify-between border-b border-border">
            <span className="text-xs font-medium text-muted-foreground">Preview: /{previewSlug}</span>
            <button
              onClick={() => { setPreviewSlug(null); setPreviewHtml('') }}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {previewLoading ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading preview…
            </div>
          ) : (
            <iframe
              srcDoc={previewHtml}
              className="w-full h-[600px] border-0"
              sandbox="allow-scripts"
              title="Page preview"
            />
          )}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack} disabled={generating}>Back</Button>
        <Button onClick={handleGenerate} disabled={generating} className="gap-2">
          {generating ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
          ) : (
            <><Github className="h-4 w-4" /> Generate & Commit to GitHub</>
          )}
        </Button>
      </div>
    </div>
  )
}
