import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Account-page reads shared between tabs. Keys match the ones the rest of the
// app invalidates (["tasks"], ["creative-requests"], ["account", name]).

export type AccountTask = {
  id: string; title: string; account_name: string | null;
  priority: string; completed: boolean; stage: string; due_date: string | null;
  created_at: string; updated_at: string;
};

export type AccountBrief = {
  id: string; account_name: string; template_name: string; ad_angle: string;
  offer_type: string; ad_type: string; status: string; notes: string | null;
  assigned_to: string | null; gdrive_folder_url: string | null;
  created_at: string; updated_at: string;
};

export type AccountRow = {
  id: string;
  account_name: string;
  gdrive_folder_url: string | null;
  report_token: string;
  fb_ad_account_id: string | null;
  target_cpl: number | null;
  target_cpa: number | null;
};

const ACCOUNT_COLUMNS = "id, account_name, gdrive_folder_url, report_token, fb_ad_account_id, target_cpl, target_cpa";

/** The account row for a name, created on first visit so every client has a stable UUID. */
export function useAccount(accountName: string) {
  return useQuery({
    queryKey: ["account", accountName],
    queryFn: async (): Promise<AccountRow> => {
      const { data: existing } = await supabase.from("accounts").select(ACCOUNT_COLUMNS).eq("account_name", accountName).maybeSingle();
      if (existing) return existing;
      const { data: inserted, error } = await supabase.from("accounts").insert({ account_name: accountName }).select(ACCOUNT_COLUMNS).single();
      if (error) throw error;
      return inserted;
    },
    staleTime: Infinity,
  });
}

export function useAccountTasks(accountName: string) {
  return useQuery({
    queryKey: ["tasks", accountName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks").select("*").eq("account_name", accountName)
        .order("completed", { ascending: true })
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AccountTask[];
    },
  });
}

export function useAccountBriefs(accountName: string) {
  return useQuery({
    queryKey: ["creative-requests", accountName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creative_requests")
        .select("*")
        .eq("account_name", accountName)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as AccountBrief[];
    },
  });
}

export type TemplateBatch = {
  name: string;
  previewImage: string | null;
  templateType: "image" | "video" | null;
  templateLink: string;
  myLink: string | null;
};

type CreativeFile = { id: string; account_name: string; batch_name: string | null; file_name: string; file_url: string; file_type: string; launch_date: string | null; created_at: string };

/** Template batches produced for this client, with the template's type and source link. */
export function useCreativeTemplates(accountName: string): TemplateBatch[] {
  const { data: clientCreatives = [] } = useQuery({
    queryKey: ["creatives", accountName],
    queryFn: async () => {
      const { data, error } = await supabase.from("creatives").select("*").eq("account_name", accountName).order("created_at", { ascending: true });
      if (error) throw error;
      return data as CreativeFile[];
    },
  });
  // Template meta rows live under any account, so read them all for type / link info.
  const { data: allCreatives = [] } = useQuery({
    queryKey: ["creatives"],
    queryFn: async () => {
      const { data, error } = await supabase.from("creatives").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      return data as CreativeFile[];
    },
  });

  return useMemo(() => {
    const mine = new Set(clientCreatives.filter((c) => c.file_type !== "template_type").map((c) => c.batch_name || "Uncategorized"));
    const map: Record<string, CreativeFile[]> = {};
    allCreatives.forEach((c) => {
      const key = c.batch_name || "Uncategorized";
      if (mine.has(key)) (map[key] ??= []).push(c);
    });
    return Object.entries(map)
      .map(([name, items]) => {
        const typeMeta = items.find((i) => i.file_type === "template_type");
        return {
          name,
          previewImage: items.find((i) => i.file_type === "image")?.file_url ?? null,
          templateType: typeMeta && (typeMeta.file_name === "image" || typeMeta.file_name === "video") ? (typeMeta.file_name as "image" | "video") : null,
          templateLink: typeMeta?.file_url ?? "",
          myLink: clientCreatives.find((c) => c.batch_name === name && c.file_type === "link")?.file_url ?? null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allCreatives, clientCreatives]);
}
