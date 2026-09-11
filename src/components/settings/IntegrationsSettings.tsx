import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { ExternalLink, Github, KeyRound, Plus, X, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SyncStatus } from "@/components/sync/SyncStatus";
import { useSyncRuns } from "@/components/sync/useSyncRuns";
import { useGitHubTokenStatus } from "@/components/claude-log/useClaudeLog";
import { formatCount } from "@/lib/format";
import { toast } from "sonner";
import { useAccountRows } from "./useAccountRows";

export function IntegrationsSettings() {
  return (
    <div className="space-y-6">
      <GitHubCard />
      <ClientLinkRules />
      <StripeCard />
    </div>
  );
}

// ─── GitHub connection ───────────────────────────────────────────────────────

const TOKEN_URL = "https://github.com/settings/personal-access-tokens/new";

function GitHubCard() {
  const queryClient = useQueryClient();
  const [token, setToken] = useState("");

  const { data: status, isLoading } = useGitHubTokenStatus();

  const saveToken = useMutation({
    mutationFn: async (value: string) => {
      const { error } = await supabase.rpc("set_github_token", { token: value });
      if (error) throw error;
    },
    onSuccess: (_d, value) => {
      setToken("");
      queryClient.invalidateQueries({ queryKey: ["github-token-status"] });
      toast.success(value ? "GitHub token saved — run a sync to pull commits" : "GitHub disconnected");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Github className="h-4 w-4" /> GitHub
        </CardTitle>
        <CardDescription>
          Feeds the Claude Log: commits since Sep 1, 2026 from every repo the token can read, synced hourly.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
          <div className="flex items-center gap-2 text-sm">
            {isLoading ? (
              <Skeleton className="h-5 w-32" />
            ) : status?.configured ? (
              <>
                <Badge variant="secondary" className="bg-success/10 text-success">Connected</Badge>
                {status.updated_at && (
                  <span className="text-xs text-muted-foreground">
                    Token set {formatDistanceToNowStrict(new Date(status.updated_at), { addSuffix: true })}
                  </span>
                )}
              </>
            ) : (
              <>
                <Badge variant="secondary" className="bg-warning/10 text-warning">Not connected</Badge>
                <span className="text-xs text-muted-foreground">Showing commits seeded from local clones only</span>
              </>
            )}
          </div>
          {status?.configured && <SyncStatus source="github" invalidate={[["claude-log"]]} />}
        </div>

        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (token.trim()) saveToken.mutate(token.trim());
          }}
        >
          <Label htmlFor="github-token">{status?.configured ? "Replace token" : "Personal access token"}</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <KeyRound className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="github-token"
                type="password"
                autoComplete="off"
                placeholder="github_pat_…"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="pl-8 font-mono text-xs"
              />
            </div>
            <Button type="submit" size="sm" className="h-10" disabled={!token.trim() || saveToken.isPending}>
              Save token
            </Button>
            {status?.configured && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10"
                disabled={saveToken.isPending}
                onClick={() => saveToken.mutate("")}
              >
                Disconnect
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Create a{" "}
            <a href={TOKEN_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 underline underline-offset-2 hover:text-foreground">
              fine-grained token <ExternalLink className="h-3 w-3" />
            </a>{" "}
            with <span className="font-medium text-foreground">All repositories</span> and{" "}
            <span className="font-medium text-foreground">Contents: Read-only</span>. It's stored encrypted in the
            database vault and can't be read back from this page.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Commit → client rules ───────────────────────────────────────────────────

type RuleKind = "keyword" | "path" | "repo";

const KIND_META: Record<RuleKind, { label: string; hint: string }> = {
  keyword: { label: "Subject contains", hint: "Matches commit subjects, e.g. “Tarheel” in “Tarheel: add /wilmington-2”." },
  path: { label: "Touches path", hint: "Any file under this folder in the chosen repo, e.g. dist/tarheel/." },
  repo: { label: "Whole repo", hint: "Every commit in the repo belongs to this client." },
};

function ClientLinkRules() {
  const queryClient = useQueryClient();
  const { data: accounts = [] } = useAccountRows();
  const [accountId, setAccountId] = useState("");
  const [kind, setKind] = useState<RuleKind>("keyword");
  const [repo, setRepo] = useState("");
  const [pattern, setPattern] = useState("");

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["github-client-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("github_client_rules")
        .select("id, account_id, kind, repo, pattern")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: repos = [] } = useQuery({
    queryKey: ["github-repos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("github_repos").select("full_name").order("full_name");
      if (error) throw error;
      return (data ?? []).map((r) => r.full_name);
    },
  });

  const { data: linkCounts = {} } = useQuery({
    queryKey: ["github-link-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("github_commit_accounts").select("account_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) counts[row.account_id] = (counts[row.account_id] ?? 0) + 1;
      return counts;
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["github-client-rules"] });
    queryClient.invalidateQueries({ queryKey: ["github-link-counts"] });
    queryClient.invalidateQueries({ queryKey: ["claude-log"] });
  };

  const addRule = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("github_client_rules").insert({
        account_id: accountId,
        kind,
        repo: kind === "path" ? repo : null,
        pattern: kind === "repo" ? repo : pattern.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setPattern("");
      invalidate();
      toast.success("Rule added — history relinked");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("github_client_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (err: Error) => toast.error(err.message),
  });

  const canAdd = !!accountId && (kind === "keyword" ? !!pattern.trim() : !!repo && (kind === "repo" || !!pattern.trim()));
  const accountName = (id: string) => accounts.find((a) => a.id === id)?.account_name ?? "Unknown account";
  const grouped = accounts
    .map((a) => ({ account: a, rules: rules.filter((r) => r.account_id === a.id) }))
    .filter((g) => g.rules.length > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Commit → client links</CardTitle>
        <CardDescription>
          How the Claude Log attributes commits to clients. Changing a rule relinks all history immediately.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-24 rounded-lg" />
        ) : grouped.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No rules yet — every commit shows as agency work.</p>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border">
            {grouped.map(({ account, rules: accountRules }) => (
              <div key={account.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 sm:w-56">
                  <p className="truncate text-sm font-medium text-foreground">{account.account_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCount(linkCounts[account.id] ?? 0)} linked commit{(linkCounts[account.id] ?? 0) === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex flex-1 flex-wrap gap-1.5 sm:justify-end">
                  {accountRules.map((r) => (
                    <span
                      key={r.id}
                      className="inline-flex max-w-full items-center gap-1 rounded-md border border-border bg-muted/50 py-0.5 pl-2 pr-0.5 text-xs"
                    >
                      <span className="text-muted-foreground">{KIND_META[r.kind as RuleKind]?.label ?? r.kind}</span>
                      <span className="truncate font-mono text-foreground">
                        {r.kind === "path" ? `${r.repo?.split("/")[1]}/${r.pattern}` : r.kind === "repo" ? r.pattern.split("/")[1] : r.pattern}
                      </span>
                      <button
                        onClick={() => removeRule.mutate(r.id)}
                        className="rounded p-0.5 text-muted-foreground hover:bg-foreground/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`Remove rule ${r.pattern} for ${accountName(r.account_id)}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Add a rule</p>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger aria-label="Client">
                <SelectValue placeholder="Client…" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={kind} onValueChange={(v) => setKind(v as RuleKind)}>
              <SelectTrigger aria-label="Match type" className="sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(KIND_META) as RuleKind[]).map((k) => (
                  <SelectItem key={k} value={k}>{KIND_META[k].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {kind !== "keyword" && (
              <Select value={repo} onValueChange={setRepo}>
                <SelectTrigger aria-label="Repository" className="sm:w-64">
                  <SelectValue placeholder="Repository…" />
                </SelectTrigger>
                <SelectContent>
                  {repos.map((r) => (
                    <SelectItem key={r} value={r}>{r.split("/")[1]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {kind !== "repo" && (
              <Input
                aria-label={kind === "path" ? "Path prefix" : "Keyword"}
                placeholder={kind === "path" ? "dist/tarheel/" : "Tarheel"}
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && canAdd && addRule.mutate()}
                className="flex-1 font-mono text-xs"
              />
            )}
            <Button size="sm" className="h-10 shrink-0" disabled={!canAdd || addRule.isPending} onClick={() => addRule.mutate()}>
              <Plus className="mr-1 h-4 w-4" /> Add
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{KIND_META[kind].hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Stripe ──────────────────────────────────────────────────────────────────

function StripeCard() {
  const { data } = useSyncRuns("stripe");
  const counts = data?.lastOk?.counts;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <CreditCard className="h-4 w-4" /> Stripe
        </CardTitle>
        <CardDescription>
          Read-only mirror of customers, subscriptions, invoices and payments, synced hourly. Powers the Revenue page.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <SyncStatus source="stripe" invalidate={[["revenue"]]} />
        {counts && (
          <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            {(["customers", "subscriptions", "invoices", "payments"] as const).map((k) => (
              <div key={k} className="rounded-lg border border-border p-2.5">
                <dt className="capitalize text-muted-foreground">{k}</dt>
                <dd className="text-sm font-semibold tabular-nums text-foreground">
                  {counts[k] != null ? formatCount(counts[k]) : "—"}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
