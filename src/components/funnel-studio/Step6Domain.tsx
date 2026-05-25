import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import type { FunnelFormData, RegistryEntry } from '@/lib/funnel-studio/types'
import { updateRegistry } from '@/lib/funnel-studio/api'

interface Props {
  data: FunnelFormData
  onFinish: (domain: string) => void
}

export function Step6Domain({ data, onFinish }: Props) {
  const [domain, setDomain] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '')

  async function handleSave() {
    if (!cleanDomain) return
    setSaving(true)
    setError('')
    try {
      const entry: RegistryEntry = {
        slug: data.slug,
        name: data.clientName,
        domain: cleanDomain,
        tecrmId: data.tecrmId || '',
        created: new Date().toISOString().split('T')[0],
        pages: data.pages.map(p => ({
          type: p.type,
          slug: p.slug,
          url: `https://${cleanDomain}/${p.slug}`,
        })),
      }
      await updateRegistry(entry)
      onFinish(cleanDomain)
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Confirm Domain</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Enter the custom domain you connected in Vercel. We'll store the live page links.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="domain">
          Custom Domain <span className="text-destructive">*</span>
        </Label>
        <Input
          id="domain"
          type="text"
          value={domain}
          onChange={e => setDomain(e.target.value)}
          placeholder="new.highqualitywaterandair.co"
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">Without https:// — e.g. new.highqualitywaterandair.co</p>
      </div>

      {cleanDomain && (
        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Live page links (preview)</p>
          <div className="space-y-2">
            {data.pages.map(p => (
              <div key={p.slug} className="flex items-center gap-3 text-sm">
                <span className="text-xs text-muted-foreground w-20 shrink-0 capitalize">{p.type.replace('-', ' ')}</span>
                <a
                  href={`https://${cleanDomain}/${p.slug}`}
                  target="_blank"
                  rel="noopener"
                  className="text-primary hover:underline font-mono text-xs truncate"
                >
                  https://{cleanDomain}/{p.slug}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={!cleanDomain || saving} className="gap-2">
          {saving ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
          ) : (
            'Save & Finish'
          )}
        </Button>
      </div>
    </div>
  )
}
