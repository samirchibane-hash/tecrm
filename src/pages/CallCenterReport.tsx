import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CallCenterDashboard } from "@/components/dashboard/CallCenterDashboard";
import { Phone } from "lucide-react";

export default function CallCenterReport() {
  const { accountName } = useParams<{ accountName: string }>();
  const decodedName = decodeURIComponent(accountName ?? "");

  const { data: account, isLoading } = useQuery({
    queryKey: ["account", decodedName],
    queryFn: async () => {
      const { data } = await supabase
        .from("accounts")
        .select("id, account_name")
        .eq("account_name", decodedName)
        .maybeSingle();
      return data;
    },
    staleTime: Infinity,
  });

  const accountId = account?.id ?? "";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Account not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="border-b border-border bg-white dark:bg-slate-900 px-4 py-3">
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-sky-600 dark:text-sky-400" />
          <h1 className="text-sm font-semibold text-foreground">{decodedName}</h1>
          <span className="text-xs text-muted-foreground">— Call Center Report</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {accountId ? (
          <CallCenterDashboard
            accountId={accountId}
            accountName={decodedName}
            isAdmin={true}
          />
        ) : (
          <p className="text-sm text-muted-foreground text-center py-12">
            No call center data found for this account.
          </p>
        )}
      </main>
    </div>
  );
}
