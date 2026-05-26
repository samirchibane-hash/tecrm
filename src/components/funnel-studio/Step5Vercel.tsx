import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { CheckCircle, ExternalLink, Copy, CheckCircle2 } from 'lucide-react'

const BASE_URL = 'https://reports.treatengine.com'

interface Props {
  slug: string
  commitSha: string
  pages: { slug: string; type: string }[]
  onNext: () => void
}

export function Step5Vercel({ slug, commitSha, pages, onNext }: Props) {
  const [checked, setChecked] = useState(Array(5).fill(false))
  const [copied, setCopied] = useState<string | null>(null)

  function copyLink(url: string) {
    navigator.clipboard.writeText(url)
    setCopied(url)
    setTimeout(() => setCopied(null), 2000)
  }

  function toggle(i: number) {
    setChecked(prev => prev.map((v, idx) => idx === i ? !v : v))
  }

  const checklistItems: React.ReactNode[] = [
    <>Go to <a href="https://vercel.com" target="_blank" rel="noopener" className="text-primary underline font-medium">vercel.com</a> → <strong>Add New Project</strong></>,
    <>Import the <code className="bg-muted px-1.5 py-0.5 rounded text-xs">tecrm</code> GitHub repo</>,
    <>Set <strong>Root Directory</strong> to: <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono ml-1">public/funnels/{slug}</code></>,
    <>Click <strong>Deploy</strong> — first deploy, Vercel subdomain is fine for now</>,
    <>Go to <strong>Settings → Domains</strong> → add your custom domain</>,
  ]

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Files committed to GitHub</h2>
        </div>
        <p className="text-sm text-muted-foreground pl-11">
          Commit: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{commitSha.slice(0, 12)}</code>
        </p>
      </div>

      {/* Preview links */}
      <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2.5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Preview links</p>
        {pages.map(p => {
          const url = `${BASE_URL}/funnels/${slug}/${p.slug}/`
          return (
            <div key={p.slug} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
              <span className="text-xs font-mono text-muted-foreground w-28 shrink-0 truncate">{p.slug}</span>
              <span className="text-xs text-muted-foreground flex-1 truncate">{url}</span>
              <button
                onClick={() => copyLink(url)}
                className="shrink-0 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                {copied === url ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
              <a href={url} target="_blank" rel="noopener noreferrer"
                className="shrink-0 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          )
        })}
        <p className="text-[11px] text-muted-foreground">Live ~1 min after Vercel redeploys from the commit above.</p>
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-5">
        <h3 className="font-medium text-sm text-foreground mb-4">Now set up the Vercel project</h3>
        <div className="space-y-4">
          {checklistItems.map((content, i) => (
            <div key={i} className="flex items-start gap-3">
              <Checkbox
                id={`check-${i}`}
                checked={checked[i]}
                onCheckedChange={() => toggle(i)}
                className="mt-0.5"
              />
              <Label
                htmlFor={`check-${i}`}
                className={`text-sm leading-relaxed cursor-pointer font-normal ${checked[i] ? 'line-through text-muted-foreground' : 'text-foreground'}`}
              >
                {content}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/10 p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Files committed</p>
        <div className="space-y-1 text-xs font-mono text-muted-foreground">
          <div>public/funnels/{slug}/</div>
          <div className="pl-5">vercel.json</div>
          <div className="pl-5">assets/images/logo.*</div>
          {pages.map(p => (
            <div key={p.slug} className="pl-5">{p.slug}/index.html</div>
          ))}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={onNext}>Next: Confirm Domain</Button>
      </div>
    </div>
  )
}
