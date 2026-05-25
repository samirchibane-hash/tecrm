import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import type { FunnelFormData } from '@/lib/funnel-studio/types'

interface Props {
  data: FunnelFormData
  onChange: (patch: Partial<FunnelFormData>) => void
  onNext: () => void
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

function Field({
  label,
  id,
  value,
  onChange,
  placeholder,
  hint,
  required = true,
  mono = false,
}: {
  label: string
  id: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: string
  required?: boolean
  mono?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={mono ? 'font-mono' : ''}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function Step1Client({ data, onChange, onNext }: Props) {
  const valid = data.clientName && data.slug && data.brandName && data.city && data.state

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Client Info</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Basic details about the client.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="Client Full Name"
          id="clientName"
          value={data.clientName}
          placeholder="High Quality Water and Air"
          onChange={v => onChange({ clientName: v, slug: slugify(v) })}
        />
        <Field
          label="URL Slug"
          id="slug"
          value={data.slug}
          placeholder="hqwa"
          hint="Auto-generated — used in file paths and URLs"
          mono
          onChange={v => onChange({ slug: v })}
        />
        <Field
          label="Brand Name (short)"
          id="brandName"
          value={data.brandName}
          placeholder="HQWA"
          onChange={v => onChange({ brandName: v })}
        />
        <Field
          label="TECRM ID"
          id="tecrmId"
          value={data.tecrmId}
          placeholder="abc123"
          hint="Optional — links to client profile in TECRM"
          required={false}
          onChange={v => onChange({ tecrmId: v })}
        />
        <Field
          label="Primary City"
          id="city"
          value={data.city}
          placeholder="Tempe"
          onChange={v => onChange({ city: v })}
        />
        <Field
          label="State"
          id="state"
          value={data.state}
          placeholder="Arizona"
          onChange={v => onChange({ state: v })}
        />
        <Field
          label="Phone Number"
          id="phone"
          value={data.phone}
          placeholder="(602) 555-0100"
          onChange={v => onChange({ phone: v })}
        />
        <Field
          label="Facebook Pixel ID"
          id="pixelId"
          value={data.pixelId}
          placeholder="1234567890"
          onChange={v => onChange({ pixelId: v })}
        />
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={onNext} disabled={!valid}>
          Next: Assets
        </Button>
      </div>
    </div>
  )
}
