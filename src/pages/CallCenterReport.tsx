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
          <div className="min-h-screen bg-canvas">
            <header className="border-b border-border bg-card">
              <div className="mx-auto max-w-2xl space-y-1.5 px-4 pb-5 pt-6">
                <p className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
                  <img src="/Treat Engine Logo .png" alt="Treat Engine" className="h-4 w-auto" />
                  <span aria-hidden>·</span>
                  <Phone className="h-3.5 w-3.5" aria-hidden />
                  Call center report
                </p>
                <h1 className="text-[28px] font-bold leading-tight tracking-tight text-foreground">{account.account_name}</h1>
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
