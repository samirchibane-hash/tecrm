import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Github, Loader2, ExternalLink, Copy, CheckCircle2 } from 'lucide-react'
import type { FunnelFormData } from '@/lib/funnel-studio/types'
import { generateFunnel } from '@/lib/funnel-studio/api'

const BASE_URL = 'https://reports.treatengine.com'

interface Props {
  data: FunnelFormData
  aiCopy?: Record<string, Record<string, unknown>>
  onSuccess: (commitSha: string) => void
  onBack: () => void
}

export function Step4Generate({ data, aiCopy, onSuccess, onBack }: Props) {
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [commitSha, setCommitSha] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  async function handleGenerate() {
    setGenerating(true)
    setError('')
    try {
      const { commitSha: sha } = await generateFunnel(data, aiCopy)
      setCommitSha(sha)
    } catch (e) {
      setError(String(e))
    } finally {
      setGenerating(false)
    }
  }

  function copyLink(url: string) {
    navigator.clipboard.writeText(url)
    setCopied(url)
    setTimeout(() => setCopied(null), 2000)
  }

  const committed = !!commitSha

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Review & Generate</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {committed ? 'Files committed — preview links are below.' : 'Confirm details, then commit to GitHub.'}
        </p>
      </div>

      {/* Summary */}
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
          <p className="text-xs font-medium text-muted-foreground mb-2">Pages:</p>
          <div className="flex flex-wrap gap-2">
            {data.pages.map(p => (
              <span key={p.slug} className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono bg-muted text-muted-foreground border border-border">
                {p.slug}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Post-commit: preview links */}
      {committed && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
            <span className="text-sm font-semibold text-foreground">Committed to GitHub</span>
            <code className="ml-1 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{commitSha.slice(0, 12)}</code>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">Preview links</p>
            <div className="space-y-2">
              {data.pages.map(p => {
                const url = `${BASE_URL}/funnels/${data.slug}/${p.slug}/`
                return (
                  <div key={p.slug} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                    <span className="text-xs font-mono text-muted-foreground w-28 shrink-0 truncate">{p.slug}</span>
                    <span className="text-xs text-muted-foreground flex-1 truncate">{url}</span>
                    <button
                      onClick={() => copyLink(url)}
                      className="shrink-0 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Copy link"
                    >
                      {copied === url ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Open in new tab"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                )
              })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2.5">
              Links go live ~1 min after Vercel finishes redeploying.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive break-words">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack} disabled={generating || committed}>Back</Button>
        {!committed ? (
          <Button onClick={handleGenerate} disabled={generating} className="gap-2">
            {generating ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
            ) : (
              <><Github className="h-4 w-4" /> Generate & Commit to GitHub</>
            )}
          </Button>
        ) : (
          <Button onClick={() => onSuccess(commitSha)} className="gap-2">
            Continue to Vercel Setup
          </Button>
        )}
      </div>
    </div>
  )
}
