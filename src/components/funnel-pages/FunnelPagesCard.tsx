import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Link2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AccountLink = Tables<"account_links">;

const byPage = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
const isSchedule = (l: AccountLink) => /schedule|calendar|booking/i.test(l.repo_path ?? l.url);

// Landing pages first in folder order (broadway-1, broadway-2 …), then the booking page.
function sortSynced(links: AccountLink[]) {
  return [...links].sort((a, b) =>
    Number(isSchedule(a)) - Number(isSchedule(b)) || byPage.compare(a.repo_path ?? "", b.repo_path ?? ""));
}

/**
 * A client's funnel pages. Rows with source "funnel_repo" are kept in sync
 * with funnels/dist by github-sync (hourly) and can only be removed there;
 * everything else is added by hand.
 */
export function FunnelPagesCard({ accountId, accountName }: { accountId: string; accountName: string }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");

  const { data: links = [], isLoading, isError } = useQuery({
    queryKey: ["account-links", accountName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_links")
        .select("*")
        .eq("account_name", accountName)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: sites } = useQuery({
    queryKey: ["funnel-sites", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase.from("funnel_sites").select("root_dir, domain").eq("account_id", accountId);
      if (error) throw error;
      return data;
    },
  });

  const addLink = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("account_links").insert({
        account_name: accountName,
        label: label.trim(),
        url: url.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["account-links", accountName] });
      setLabel("");
      setUrl("");
      setShowForm(false);
      toast.success("Link saved");
    },
    onError: () => toast.error("Failed to save link"),
  });

  const deleteLink = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("account_links").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["account-links", accountName] }),
    onError: () => toast.error("Failed to delete link"),
  });

  const synced = sortSynced(links.filter((l) => l.source === "funnel_repo"));
  const manual = links.filter((l) => l.source !== "funnel_repo");
  const siteDirs = (sites ?? []).map((s) => s.root_dir).join(", ");

  const row = (link: AccountLink) => (
    <li key={link.id} className="group flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{link.label}</p>
        {link.page_title && (
          <p className="truncate text-xs text-muted-foreground" title={link.page_title}>{link.page_title}</p>
        )}
        <p className="truncate text-xs text-muted-foreground">{link.url}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={() => { navigator.clipboard.writeText(link.url); toast.success("Link copied"); }}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          title="Copy link"
          aria-label={`Copy ${link.label} link`}
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          title="Open in new tab"
          aria-label={`Open ${link.label} in a new tab`}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        {link.source !== "funnel_repo" && (
          <button
            onClick={() => deleteLink.mutate(link.id)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-colors hover:bg-danger/10 hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
            title="Delete"
            aria-label={`Delete ${link.label}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </li>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            Funnel Pages
            {links.length > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {links.length}
              </span>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setShowForm((v) => !v)}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Link
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="flex items-end gap-2 rounded-xl border border-border bg-muted/20 p-3">
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <Label className="mb-1 block text-xs text-muted-foreground">Label</Label>
                <Input placeholder="e.g. Landing Page" value={label} onChange={(e) => setLabel(e.target.value)} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="mb-1 block text-xs text-muted-foreground">URL</Label>
                <Input placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} className="h-8 text-sm" />
              </div>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <Button size="sm" className="h-8" disabled={!label.trim() || !url.trim() || addLink.isPending} onClick={() => addLink.mutate()}>Save</Button>
              <Button variant="ghost" size="sm" className="h-8" onClick={() => { setShowForm(false); setLabel(""); setUrl(""); }}>Cancel</Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
          </div>
        ) : isError ? (
          <p className="text-xs text-danger">Couldn't load funnel pages.</p>
        ) : (
          <>
            {synced.length > 0 && (
              <section className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Live pages</h3>
                  <span className="truncate font-mono text-[11px] text-muted-foreground" title="Synced hourly from the funnels repo">
                    {siteDirs}
                  </span>
                </div>
                <ul className="space-y-2">{synced.map(row)}</ul>
              </section>
            )}
            {manual.length > 0 && (
              <section className="space-y-2">
                {synced.length > 0 && (
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Added manually</h3>
                )}
                <ul className="space-y-2">{manual.map(row)}</ul>
              </section>
            )}
            {links.length === 0 && !showForm && (
              <p className="py-2 text-sm text-muted-foreground">No funnel pages added yet.</p>
            )}
            {sites && (
              <p className="text-xs text-muted-foreground">
                {sites.length > 0
                  ? "Pages in the funnels repo list here within an hour of reaching main. Remove a live page there, not here."
                  : "No funnels repo folder is linked to this client, so pages here are added by hand."}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
