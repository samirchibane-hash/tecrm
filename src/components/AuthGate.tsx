import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Lock } from "lucide-react";

// Guards every internal CRM route. Access is a Supabase Auth session whose email
// is on the admin_users allowlist — the database enforces the same check in RLS,
// so this gate is for UX, not the security boundary.
export function AuthGate() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, []);

  const { data: isAdmin, isLoading: checkingAdmin } = useQuery({
    queryKey: ["is-admin", session?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_admin");
      if (error) throw error;
      return data === true;
    },
    enabled: !!session,
    staleTime: Infinity,
  });

  if (session === undefined || (session && checkingAdmin)) {
    return (
      <GateShell>
        <div className="flex justify-center py-6" role="status" aria-label="Checking sign-in">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </GateShell>
    );
  }

  if (!session) return <SignInForm />;

  if (!isAdmin) {
    return (
      <GateShell>
        <p className="text-sm text-muted-foreground text-center">
          {session.user.email} doesn't have access to TE Reports.
        </p>
        <Button variant="outline" className="w-full" onClick={() => supabase.auth.signOut()}>
          Sign out
        </Button>
      </GateShell>
    );
  }

  return <Outlet />;
}

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) setError(signInError.message);
    setSubmitting(false);
  };

  return (
    <GateShell>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          type="email"
          placeholder="Email"
          autoComplete="email"
          aria-label="Email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(null); }}
          autoFocus
        />
        <Input
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          aria-label="Password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(null); }}
          className={error ? "border-destructive focus-visible:ring-destructive" : ""}
        />
        {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
        <Button type="submit" className="w-full" disabled={!email || !password || submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
        </Button>
      </form>
    </GateShell>
  );
}

function GateShell({ children }: { children: React.ReactNode }) {
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
          <p className="text-sm text-muted-foreground">Sign in to continue</p>
        </div>
        {children}
      </div>
    </div>
  );
}
