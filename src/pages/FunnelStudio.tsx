import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Layers, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProgressBar } from '@/components/funnel-studio/ProgressBar'
import { Step1Client } from '@/components/funnel-studio/Step1Client'
import { Step2Assets } from '@/components/funnel-studio/Step2Assets'
import { Step3Pages } from '@/components/funnel-studio/Step3Pages'
import { Step4Generate } from '@/components/funnel-studio/Step4Generate'
import { Step5Vercel } from '@/components/funnel-studio/Step5Vercel'
import { Step6Domain } from '@/components/funnel-studio/Step6Domain'
import { SuccessScreen } from '@/components/funnel-studio/SuccessScreen'
import type { FunnelFormData } from '@/lib/funnel-studio/types'

const EMPTY_FORM: FunnelFormData = {
  clientName: '',
  slug: '',
  tecrmId: '',
  brandName: '',
  phone: '',
  pixelId: '',
  city: '',
  state: '',
  stateAbbr: '',
  webhookUrl: '',
  calendarEmbedUrl: '',
  pages: [],
}

export default function FunnelStudio() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FunnelFormData>({ ...EMPTY_FORM })
  const [logoPreview, setLogoPreview] = useState('')
  const [aiCopy, setAiCopy] = useState<Record<string, Record<string, unknown>> | undefined>()
  const [commitSha, setCommitSha] = useState('')
  const [finalDomain, setFinalDomain] = useState('')

  function patch(data: Partial<FunnelFormData>) {
    setForm(prev => ({ ...prev, ...data }))
  }

  function handleLogoUpload(base64: string, ext: string, preview: string) {
    setForm(prev => ({ ...prev, logoBase64: base64, logoExt: ext }))
    setLogoPreview(preview)
  }

  function resetWizard() {
    setStep(1)
    setForm({ ...EMPTY_FORM })
    setLogoPreview('')
    setAiCopy(undefined)
    setCommitSha('')
    setFinalDomain('')
  }

  const isDone = step === 7

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:py-10 sm:px-6">

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
          <Button variant="ghost" size="sm" asChild>
            <Link to="/funnel-studio/clients" className="gap-1.5">
              <Users className="h-4 w-4" />
              <span className="text-xs">All Clients</span>
            </Link>
          </Button>
        </div>

        {/* Wizard */}
        {!isDone && <ProgressBar current={step} />}

        <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
          {step === 1 && (
            <Step1Client data={form} onChange={patch} onNext={() => setStep(2)} />
          )}
          {step === 2 && (
            <Step2Assets
              data={form}
              logoPreview={logoPreview}
              onChange={patch}
              onLogoUpload={handleLogoUpload}
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <Step3Pages
              data={form}
              onChange={pages => patch({ pages })}
              onNext={copy => { setAiCopy(copy); setStep(4) }}
              onBack={() => setStep(2)}
            />
          )}
          {step === 4 && (
            <Step4Generate
              data={form}
              aiCopy={aiCopy}
              onSuccess={sha => { setCommitSha(sha); setStep(5) }}
              onBack={() => setStep(3)}
            />
          )}
          {step === 5 && (
            <Step5Vercel
              slug={form.slug}
              commitSha={commitSha}
              pages={form.pages}
              onNext={() => setStep(6)}
            />
          )}
          {step === 6 && (
            <Step6Domain
              data={form}
              onFinish={domain => {
                setFinalDomain(domain)
                setForm(prev => ({ ...prev, domain }))
                setStep(7)
              }}
            />
          )}
          {step === 7 && (
            <SuccessScreen data={form} domain={finalDomain} onNewClient={resetWizard} />
          )}
        </div>
      </div>
    </div>
  )
}
