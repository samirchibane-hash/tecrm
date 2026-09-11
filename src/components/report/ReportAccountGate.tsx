import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSupabase, useSupabaseScope } from "@/integrations/supabase/SupabaseContext";

export interface ReportAccount {
  id: string;
  account_name: string;
}

// Resolves the report token (carried by the scoped client from
// ReportClientProvider) to its account before the report renders, so the page
// below never runs queries for an invalid or retired link.
export function ReportAccountGate({ children }: { children: (account: ReportAccount) => ReactNode }) {
  const supabase = useSupabase();
  const scope = useSupabaseScope();

  const { data: account, isLoading, isError } = useQuery({
    queryKey: ["report-account", scope],
    queryFn: async () => {
      // RLS only exposes the account matching the x-report-token header.
      const { data, error } = await supabase.from("accounts").select("id, account_name").maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: Infinity,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground" role="status">Loading…</p>
      </div>
    );
  }

  if (isError || !account) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-sm text-center space-y-2">
          <h1 className="text-base font-semibold text-foreground">This report link isn't valid</h1>
          <p className="text-sm text-muted-foreground">
            It may have been replaced with a new one. Ask your Treat Engine account manager for your current report link.
          </p>
        </div>
      </div>
    );
  }

  return <>{children(account)}</>;
}
