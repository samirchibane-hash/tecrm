import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CallCenterDashboard } from "@/components/dashboard/CallCenterDashboard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Phone, Lock, Unlock } from "lucide-react";

const SESSION_KEY = "te_admin_verified";
const PASSCODE = import.meta.env.VITE_ADMIN_PASSCODE as string | undefined;

export default function CallCenterReport() {
  const { accountName } = useParams<{ accountName: string }>();
  const decodedName = decodeURIComponent(accountName ?? "");

  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem(SESSION_KEY) === "1");
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [passcodeError, setPasscodeError] = useState(false);

  function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (PASSCODE && passcodeInput === PASSCODE) {
      sessionStorage.setItem(SESSION_KEY, "1");
      setIsAdmin(true);
      setUnlockOpen(false);
      setPasscodeInput("");
    } else {
      setPasscodeError(true);
      setPasscodeInput("");
    }
  }

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
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            <h1 className="text-sm font-semibold text-foreground">{decodedName}</h1>
            <span className="text-xs text-muted-foreground">— Call Center Report</span>
          </div>

          {/* Admin unlock */}
          {isAdmin ? (
            <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              <Unlock className="h-3 w-3" /> Admin
            </span>
          ) : (
            <div className="flex items-center gap-2">
              {unlockOpen ? (
                <form onSubmit={handleUnlock} className="flex items-center gap-1.5">
                  <Input
                    type="password"
                    placeholder="Passcode"
                    value={passcodeInput}
                    onChange={(e) => { setPasscodeInput(e.target.value); setPasscodeError(false); }}
                    className={`h-7 w-28 text-xs ${passcodeError ? "border-destructive" : ""}`}
                    autoFocus
                  />
                  <Button type="submit" size="sm" className="h-7 text-xs px-2" disabled={!passcodeInput}>
                    Unlock
                  </Button>
                  <button
                    type="button"
                    onClick={() => { setUnlockOpen(false); setPasscodeInput(""); setPasscodeError(false); }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setUnlockOpen(true)}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Lock className="h-3 w-3" /> Admin
                </button>
              )}
            </div>
          )}
        </div>
        {passcodeError && (
          <p className="mt-1 text-xs text-destructive">Incorrect passcode.</p>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {accountId ? (
          <CallCenterDashboard
            accountId={accountId}
            accountName={decodedName}
            isAdmin={isAdmin}
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
