import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layers, Plus, ExternalLink, Copy, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getRegistry } from '@/lib/funnel-studio/api'
import type { RegistryEntry } from '@/lib/funnel-studio/types'

export default function FunnelStudioClients() {
  const [registry, setRegistry] = useState<RegistryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getRegistry()
      .then(data => { setRegistry(data); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:py-10 sm:px-6">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/">
              <img
                src="/Treat Engine Logo .png"
                alt="Treat Engine"
                className="h-7 w-auto"
              />
            </Link>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Funnel Studio</span>
            </div>
          </div>
          <Button size="sm" asChild>
            <Link to="/funnel-studio" className="gap-1.5">
              <Plus className="h-4 w-4" />
              New Client
            </Link>
          </Button>
        </div>

        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground">All Clients</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {registry.length} client{registry.length !== 1 ? 's' : ''} in the registry
          </p>
        </div>

        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {!loading && !error && registry.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
            <Layers className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-3">No clients yet.</p>
            <Button variant="outline" size="sm" asChild>
              <Link to="/funnel-studio">Create your first client →</Link>
            </Button>
          </div>
        )}

        {!loading && registry.length > 0 && (
          <div className="space-y-3">
            {registry.map(client => (
              <div key={client.slug} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground">{client.name}</h3>
                      <code className="bg-muted text-muted-foreground px-1.5 py-0.5 rounded text-xs">{client.slug}</code>
                      {client.tecrmId && (
                        <span className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded">
                          TECRM: {client.tecrmId}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      <a
                        href={`https://${client.domain}`}
                        target="_blank"
                        rel="noopener"
                        className="text-primary hover:underline font-medium"
                      >
                        {client.domain}
                      </a>
                      <span className="ml-2">· Added {client.created}</span>
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-border/60">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Live Pages</p>
                  <div className="flex flex-wrap gap-2">
                    {client.pages.map(p => (
                      <a
                        key={p.slug}
                        href={p.url}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex items-center gap-1.5 text-xs text-foreground bg-muted border border-border rounded-lg px-3 py-1.5 hover:bg-muted/70 transition-colors font-medium"
                      >
                        <span className="text-muted-foreground capitalize">{p.type.replace('-', ' ')}</span>
                        <span>/{p.slug}</span>
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </a>
                    ))}
                    <button
                      onClick={() => {
                        const links = client.pages.map(p => `${p.type}: ${p.url}`).join('\n')
                        navigator.clipboard.writeText(links)
                      }}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground px-2 py-1.5 rounded-lg hover:bg-muted hover:text-foreground transition-colors"
                      title="Copy all links"
                    >
                      <Copy className="h-3 w-3" />
                      Copy all
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
