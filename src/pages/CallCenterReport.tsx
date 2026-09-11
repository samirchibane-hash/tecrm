import { useParams } from "react-router-dom";
import { ReportClientProvider } from "@/integrations/supabase/SupabaseContext";
import { ReportAccountGate } from "@/components/report/ReportAccountGate";
import { CallCenterDashboard } from "@/components/dashboard/CallCenterDashboard";
import { Phone } from "lucide-react";

export default function CallCenterReport() {
  const { token = "" } = useParams<{ token: string }>();

  return (
    <ReportClientProvider token={token}>
      <ReportAccountGate>
        {(account) => (
          <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            {/* Header */}
            <header className="border-b border-border bg-white dark:bg-slate-900 px-4 py-3">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                <h1 className="text-sm font-semibold text-foreground">{account.account_name}</h1>
                <span className="text-xs text-muted-foreground">— Call Center Report</span>
              </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-6">
              <CallCenterDashboard
                accountId={account.id}
                accountName={account.account_name}
                isAdmin={true}
              />
            </main>
          </div>
        )}
      </ReportAccountGate>
    </ReportClientProvider>
  );
}
