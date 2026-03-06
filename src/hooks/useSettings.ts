import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { KpiKey } from "@/components/dashboard/AccountCard";

export type ChangeLogOption = {
  label: string;
  sub_options: string[];
};

interface SettingsRow {
  id: string;
  enabled_kpis: KpiKey[];
  // Stored in the `default_campaigns` DB column; normalized from string[] on read
  change_log_options: ChangeLogOption[];
  visible_kpis: KpiKey[];
  hidden_accounts: string[];
  updated_at: string;
}

const DEFAULTS: Omit<SettingsRow, "id" | "updated_at"> = {
  enabled_kpis: [
    "totalSpend", "totalClicks", "totalImpressions", "totalReach",
    "avgCTR", "avgCPC", "avgCPM", "webApptTotal", "webApptCost",
    "apptTotal", "apptCost", "leadsTotal", "leadsCost",
    "fbLeadsTotal", "fbLeadsCost", "ghlLeads", "ghlAppointments",
  ] as KpiKey[],
  change_log_options: [
    { label: "CRM", sub_options: [] },
    { label: "Retell Ai", sub_options: [] },
  ],
  visible_kpis: ["totalSpend", "totalClicks", "totalImpressions", "avgCTR"] as KpiKey[],
  hidden_accounts: [],
};

// Normalize the default_campaigns column value — supports both old string[] and new ChangeLogOption[]
function normalizeChangeLogOptions(raw: unknown): ChangeLogOption[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULTS.change_log_options;
  return raw.map((item) =>
    typeof item === "string" ? { label: item, sub_options: [] } : (item as ChangeLogOption)
  );
}

async function fetchSettings(): Promise<Omit<SettingsRow, "id" | "updated_at">> {
  const { data, error } = await supabase
    .from("settings" as any)
    .select("*")
    .eq("id", "global")
    .maybeSingle();
  if (error) throw error;
  if (!data) return DEFAULTS;
  return {
    enabled_kpis: (data as any).enabled_kpis ?? DEFAULTS.enabled_kpis,
    change_log_options: normalizeChangeLogOptions((data as any).default_campaigns),
    visible_kpis: (data as any).visible_kpis ?? DEFAULTS.visible_kpis,
    hidden_accounts: (data as any).hidden_accounts ?? DEFAULTS.hidden_accounts,
  };
}

export function useSettings() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: async (patch: Partial<Omit<SettingsRow, "id" | "updated_at">>) => {
      const current = queryClient.getQueryData<Omit<SettingsRow, "id" | "updated_at">>(["settings"]) ?? DEFAULTS;
      const merged = { ...current, ...patch };
      const { error } = await supabase
        .from("settings" as any)
        .update({
          enabled_kpis: merged.enabled_kpis,
          default_campaigns: merged.change_log_options, // persisted in default_campaigns column
          visible_kpis: merged.visible_kpis,
          hidden_accounts: merged.hidden_accounts,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", "global");
      if (error) throw error;
      return merged;
    },
    onMutate: async (patch) => {
      // Optimistic update so the UI reflects changes immediately
      await queryClient.cancelQueries({ queryKey: ["settings"] });
      const previous = queryClient.getQueryData(["settings"]);
      const current = queryClient.getQueryData<Omit<SettingsRow, "id" | "updated_at">>(["settings"]) ?? DEFAULTS;
      queryClient.setQueryData(["settings"], { ...current, ...patch });
      return { previous };
    },
    onError: (_err, _patch, context: any) => {
      queryClient.setQueryData(["settings"], context?.previous);
    },
    onSuccess: (merged) => {
      queryClient.setQueryData(["settings"], merged);
    },
  });

  return {
    settings: settings ?? DEFAULTS,
    isLoading,
    updateSettings: mutation.mutate,
  };
}
