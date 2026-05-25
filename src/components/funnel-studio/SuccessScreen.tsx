import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { CheckCircle, Copy, ExternalLink } from 'lucide-react'
import type { FunnelFormData } from '@/lib/funnel-studio/types'

interface Props {
  data: FunnelFormData
  domain: string
  onNewClient: () => void
}

export function SuccessScreen({ data, domain, onNewClient }: Props) {
  return (
    <div className="space-y-6 py-2">
      <div className="flex flex-col items-center text-center gap-3">
        <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">{data.clientName} is live</h2>
          <p className="text-sm text-muted-foreground mt-1">All pages committed to GitHub and registry updated.</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Live Page Links</p>
        <div className="space-y-2.5">
          {data.pages.map(p => (
            <div key={p.slug} className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground w-20 shrink-0 capitalize">{p.type.replace('-', ' ')}</span>
              <a
                href={`https://${domain}/${p.slug}`}
                target="_blank"
                rel="noopener"
                className="flex-1 text-xs text-primary font-mono hover:underline flex items-center gap-1 min-w-0 truncate"
              >
                https://{domain}/{p.slug}
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
              <button
                onClick={() => navigator.clipboard.writeText(`https://${domain}/${p.slug}`)}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                title="Copy URL"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {data.tecrmId && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-800 dark:text-amber-300">
          <strong>TECRM ID:</strong> {data.tecrmId} — Link these page URLs to the client profile in your CRM.
        </div>
      )}

      <div className="flex gap-3 justify-center pt-2">
        <Button onClick={onNewClient}>+ New Client</Button>
        <Button variant="outline" asChild>
          <Link to="/funnel-studio/clients">View All Clients</Link>
        </Button>
      </div>
    </div>
  )
}
