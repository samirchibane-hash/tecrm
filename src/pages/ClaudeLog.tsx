import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, FolderGit2, GitCommitHorizontal, Search, Sparkles, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/PageHeader";
import { KpiStatCard } from "@/components/dashboard/KpiStatCard";
import { SyncStatus } from "@/components/sync/SyncStatus";
import { CommitRow } from "@/components/claude-log/CommitRow";
import { groupByDay } from "@/components/claude-log/groupByDay";
import { repoShortName, useGitHubTokenStatus, useWorkStream } from "@/components/claude-log/useClaudeLog";
import { filterWorkEvents } from "@/components/claude-log/workStream";
import { useSettings } from "@/hooks/useSettings";
import { formatCount } from "@/lib/format";

const ALL = "all";
const AGENCY = "agency"; // commits linked to no client

function dayDigest(
  day: { events: { source: string }[]; repos: string[] },
  clientNames: (string | undefined)[],
): string {
  const names = clientNames.filter((name): name is string => !!name);
  const commits = day.events.filter((event) => event.source === "github").length;
  const ops = day.events.length - commits;
  return [
    commits ? `${commits} commit${commits === 1 ? "" : "s"}` : null,
    ops ? `${ops} ops outcome${ops === 1 ? "" : "s"}` : null,
    day.repos.length ? day.repos.join(", ") : null,
    names.length ? names.join(", ") : null,
  ].filter((bit): bit is string => !!bit).join(" · ");
}

export default function ClaudeLog() {
  const [params, setParams] = useSearchParams();
  const client = params.get("client") ?? ALL;
  const repo = params.get("repo") ?? ALL;
  const q = params.get("q") ?? "";

  const setParam = (key: string, value: string, fallback = ALL) => {
    const next = new URLSearchParams(params);
    if (!value || value === fallback) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const { data: events = [], isLoading, isError, error, refetch } = useWorkStream();
  const { data: token } = useGitHubTokenStatus();
  const { settings } = useSettings();
  const { data: accounts = [] } = useQuery({
    queryKey: ["all-accounts"],
    queryFn: async () => {
      const { data } = await supabase.from("accounts").select("id, account_name");
      return data ?? [];
    },
  });

  const accountName = (id: string) => accounts.find((a) => a.id === id)?.account_name;
  const active = accounts
    .filter((a) => !settings.hidden_accounts.includes(a.account_name))
    .sort((a, b) => a.account_name.localeCompare(b.account_name));
  const inactiveWithWork = accounts.filter(
    (a) => settings.hidden_accounts.includes(a.account_name) && events.some((e) => e.accountIds.includes(a.id)),
  );
  const repos = [...new Set(events.flatMap((e) => (e.repo ? [e.repo] : [])))].sort((a, b) => repoShortName(a).localeCompare(repoShortName(b)));
  const countFor = (accountId: string) => events.filter((e) => e.accountIds.includes(accountId)).length;

  const filtered = useMemo(
    () => filterWorkEvents(events, { client, repo, query: q }),
    [events, client, repo, q],
  );
  const github = filtered.filter((e) => e.source === "github");

  const days = useMemo(() => groupByDay(filtered), [filtered]);
  const linked = github.filter((e) => e.accountIds.length > 0).length;
  const lines = github.reduce((s, e) => s + (e.additions ?? 0) + (e.deletions ?? 0), 0);
  const hasLineStats = github.some((e) => e.additions != null);
  const claudeShare = github.length ? Math.round((github.filter((e) => e.claudeCoauthored).length / github.length) * 100) : 0;
  const filtersOn = client !== ALL || repo !== ALL || !!q;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <PageHeader
        title="Claude Log"
        description="Shipped work since Sep 1, 2026 — GitHub pushes and ops outcomes — each tagged with its source and client."
        actions={token?.configured ? <SyncStatus source="github" invalidate={[["claude-log"]]} /> : undefined}
      />

      {token && !token.configured && (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div>
              <p className="text-sm font-medium text-foreground">GitHub isn't connected yet</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                This log was seeded once from the repos cloned on the workstation (Treat Engine website, TECRM, funnels,
                ClearDeals). Connect a read-only token to sync every repo hourly.
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link to="/settings/integrations">Connect GitHub</Link>
          </Button>
        </div>
      )}

      {/* Filters — one row above the content they drive */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search commits"
            placeholder="Search summaries…"
            value={q}
            onChange={(e) => setParam("q", e.target.value, "")}
            className="h-9 pl-8 text-sm"
          />
        </div>
        <Select value={client} onValueChange={(v) => setParam("client", v)}>
          <SelectTrigger aria-label="Client" className="h-9 sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All work</SelectItem>
            <SelectItem value={AGENCY}>Agency work (no client)</SelectItem>
            <SelectGroup>
              <SelectLabel>Active clients</SelectLabel>
              {active.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.account_name} <span className="text-muted-foreground">({countFor(a.id)})</span>
                </SelectItem>
              ))}
            </SelectGroup>
            {inactiveWithWork.length > 0 && (
              <SelectGroup>
                <SelectLabel>Hidden clients</SelectLabel>
                {inactiveWithWork.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.account_name} <span className="text-muted-foreground">({countFor(a.id)})</span>
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
        <Select value={repo} onValueChange={(v) => setParam("repo", v)}>
          <SelectTrigger aria-label="Repository" className="h-9 sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All repos</SelectItem>
            {repos.map((r) => (
              <SelectItem key={r} value={r}>{repoShortName(r)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isError ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-danger/30 bg-danger/5 px-6 py-10 text-center">
          <AlertTriangle className="h-5 w-5 text-danger" />
          <div>
            <p className="text-sm font-medium text-foreground">Couldn't load the log</p>
            <p className="mt-1 text-xs text-muted-foreground">{(error as Error)?.message}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button>
        </div>
      ) : isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiStatCard icon={GitCommitHorizontal} label="Commits" value={formatCount(github.length)} />
            <KpiStatCard icon={FolderGit2} label="Repos" value={formatCount(new Set(github.flatMap((e) => (e.repo ? [e.repo] : []))).size)} />
            <KpiStatCard
              icon={Users}
              label="Client-linked"
              value={formatCount(linked)}
              detail={`${formatCount(github.length - linked)} agency-wide`}
            />
            <KpiStatCard
              icon={Sparkles}
              label="Claude co-authored"
              value={github.length ? `${claudeShare}%` : "—"}
              detail={hasLineStats ? `${formatCount(lines)} lines changed` : undefined}
            />
          </div>

          {days.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
              <p className="text-sm font-medium text-foreground">{filtersOn ? "No work matches these filters" : "No work since Sep 1"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {filtersOn
                  ? "Try another client or repo, or clear the search."
                  : "Once GitHub is connected, the hourly sync fills this in."}
              </p>
              {filtersOn && (
                <Button variant="ghost" size="sm" className="mt-3" onClick={() => setParams({}, { replace: true })}>
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {days.map((day) => {
                const clientNames = day.accountIds.map(accountName).filter(Boolean);
                return (
                  <section key={day.key} aria-labelledby={`day-${day.key}`}>
                    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-1">
                      <h2 id={`day-${day.key}`} className="text-sm font-semibold text-foreground">{day.label}</h2>
                      {/* The day's digest: how much, where, and for whom. */}
                      <p className="text-xs text-muted-foreground">
                        {dayDigest(day, clientNames)}
                      </p>
                    </div>
                    <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-card">
                      {day.events.map((event) => (
                        <CommitRow key={event.id} event={event} accountName={accountName} />
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
