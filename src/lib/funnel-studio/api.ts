import { supabase } from '@/integrations/supabase/client'
import type { FunnelFormData, PageConfig, RegistryEntry } from './types'

export async function generateCopy(
  formData: FunnelFormData,
  pages: PageConfig[]
): Promise<Record<string, Record<string, unknown>>> {
  const { data, error } = await supabase.functions.invoke('funnel-copy-gen', {
    body: { formData, pages },
  })
  if (error) throw new Error(data?.error ?? error.message)
  if (data?.error) throw new Error(data.error)
  return data.copy
}

export async function generateFunnel(
  formData: FunnelFormData,
  aiCopy?: Record<string, Record<string, unknown>>
): Promise<{ commitSha: string }> {
  const { data, error } = await supabase.functions.invoke('funnel-generate', {
    body: { formData, aiCopy },
  })
  if (error) throw new Error(data?.error ?? error.message)
  if (data?.error) throw new Error(data.error)
  return { commitSha: data.commitSha }
}

export async function previewPage(
  pageType: string,
  config: Record<string, unknown>
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('funnel-preview', {
    body: { pageType, config },
  })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return data.html as string
}

export async function getRegistry(): Promise<RegistryEntry[]> {
  const { data, error } = await supabase.functions.invoke('funnel-registry', {
    body: { action: 'get' },
  })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return data.registry ?? []
}

export async function updateRegistry(entry: RegistryEntry): Promise<void> {
  const { data, error } = await supabase.functions.invoke('funnel-registry', {
    body: { action: 'patch', entry },
  })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
}
