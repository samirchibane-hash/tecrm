import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

const SESSION_KEY = "te_admin_verified";
const PASSCODE = import.meta.env.VITE_ADMIN_PASSCODE as string | undefined;

export function PasscodeGate({ children }: { children: React.ReactNode }) {
  const [verified, setVerified] = useState(() => sessionStorage.getItem(SESSION_KEY) === "1");
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  if (verified) return <>{children}</>;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (PASSCODE && input === PASSCODE) {
      sessionStorage.setItem(SESSION_KEY, "1");
      setVerified(true);
    } else {
      setError(true);
      setInput("");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Lock className="h-6 w-6 text-primary" />
            </div>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">TE Reports</h1>
          <p className="text-sm text-muted-foreground">Enter your passcode to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="password"
            placeholder="Passcode"
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(false); }}
            className={error ? "border-destructive focus-visible:ring-destructive" : ""}
            autoFocus
          />
          {error && <p className="text-xs text-destructive">Incorrect passcode. Try again.</p>}
          <Button type="submit" className="w-full" disabled={!input}>
            Unlock
          </Button>
        </form>
      </div>
    </div>
  );
}
