import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { LogoUpload } from './LogoUpload'
import type { FunnelFormData } from '@/lib/funnel-studio/types'

interface Props {
  data: FunnelFormData
  logoPreview: string
  onChange: (patch: Partial<FunnelFormData>) => void
  onLogoUpload: (base64: string, ext: string, preview: string) => void
  onNext: () => void
  onBack: () => void
}

export function Step2Assets({ data, logoPreview, onChange, onLogoUpload, onNext, onBack }: Props) {
  const valid = data.webhookUrl && data.calendarEmbedUrl

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Assets & Integrations</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Upload the client logo and paste their GHL URLs.</p>
      </div>

      <div className="space-y-2">
        <Label>Client Logo</Label>
        <LogoUpload onUpload={onLogoUpload} preview={logoPreview} />
        {!logoPreview && (
          <p className="text-xs text-muted-foreground">Optional — pages will show a placeholder if skipped</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="webhookUrl">
          GHL Inbound Webhook URL <span className="text-destructive">*</span>
        </Label>
        <Input
          id="webhookUrl"
          type="url"
          value={data.webhookUrl}
          onChange={e => onChange({ webhookUrl: e.target.value })}
          placeholder="https://services.leadconnectorhq.com/hooks/..."
          className="font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">Goes into all landing page zip code forms</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="calendarEmbedUrl">
          GHL Calendar Embed URL <span className="text-destructive">*</span>
        </Label>
        <Input
          id="calendarEmbedUrl"
          type="url"
          value={data.calendarEmbedUrl}
          onChange={e => onChange({ calendarEmbedUrl: e.target.value })}
          placeholder="https://api.leadconnectorhq.com/widget/booking/..."
          className="font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">Used in the schedule/booking page iframe</p>
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={!valid}>
          Next: Pages
        </Button>
      </div>
    </div>
  )
}
