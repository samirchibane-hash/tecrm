import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ClipboardList, Image as ImageIcon, Film, User, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusPill } from "@/components/StatusPill";
import { STATUS_STEPS, STATUS_LABEL, type RequestStatus } from "@/components/creatives/types";
import { StaffBriefSheet } from "@/components/staff-briefs/StaffBriefSheet";
import {
  useStaffBriefs, InvalidStaffLinkError, STAGE_TONE, adTypeLabel, briefTitle, type StaffBrief,
} from "@/components/staff-briefs/useStaffBriefs";
import { cn } from "@/lib/utils";

type View = "open" | "launched";

// Public, read-only brief queue for staff without a CRM login (/briefs/:token).
export default function StaffBriefs() {
  const { token = "" } = useParams<{ token: string }>();
  const { data: briefs = [], isLoading, error, refetch } = useStaffBriefs(token);

  const [view, setView] = useState<View>("open");
  const [client, setClient] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const clients = useMemo(
    () => [...new Set(briefs.filter((b) => !b.is_template).map((b) => b.account_name))].sort(),
    [briefs],
  );

  const visible = useMemo(() => briefs.filter((b) => {
    if ((view === "launched") !== (b.status === "launched")) return false;
    if (client !== "all" && b.account_name !== client) return false;
    return true;
  }), [briefs, view, client]);

  const openCount = briefs.filter((b) => b.status !== "launched").length;
  const selected = briefs.find((b) => b.id === selectedId) ?? null;
  const stages = (view === "open" ? STATUS_STEPS.filter((s) => s !== "launched") : ["launched"]) as RequestStatus[];

  if (error instanceof InvalidStaffLinkError || (!isLoading && !token)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-sm text-center space-y-2">
          <h1 className="text-base font-semibold text-foreground">This briefs link isn't valid</h1>
          <p className="text-sm text-muted-foreground">It may have been replaced with a new one. Ask Treat Engine for the current link.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3 sm:px-6">
          <ClipboardList className="h-4 w-4 text-primary" aria-hidden />
          <h1 className="text-sm font-semibold text-foreground">Creative Briefs</h1>
          <span className="text-xs text-muted-foreground">— Treat Engine</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as View)}>
            <TabsList>
              <TabsTrigger value="open">Open{!isLoading && ` · ${openCount}`}</TabsTrigger>
              <TabsTrigger value="launched">Launched</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select value={client} onValueChange={setClient}>
            <SelectTrigger className="h-9 w-[200px] text-xs" aria-label="Filter by client"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {clients.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isLoading && (
          <div className="space-y-2" role="status" aria-label="Loading briefs">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        )}

        {error && !(error instanceof InvalidStaffLinkError) && (
          <div className="rounded-xl border border-border p-6 text-center space-y-3">
            <p className="text-sm text-danger">Couldn't load briefs: {(error as Error).message}</p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>Try again</Button>
          </div>
        )}

        {!isLoading && !error && visible.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <ClipboardList className="h-10 w-10 text-muted-foreground/40" aria-hidden />
            <p className="text-sm font-medium text-foreground">
              {view === "open" ? "No open briefs" : "No launched briefs"}{client !== "all" && ` for ${client}`}
            </p>
          </div>
        )}

        {!isLoading && !error && visible.length > 0 && (
          <div className="space-y-6">
            {stages.map((stage) => {
              const group = visible.filter((b) => b.status === stage);
              if (group.length === 0) return null;
              return (
                <section key={stage} aria-labelledby={`stage-${stage}`}>
                  <div className="mb-2 flex items-center gap-2">
                    <h2 id={`stage-${stage}`} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{STATUS_LABEL[stage]}</h2>
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{group.length}</span>
                  </div>
                  <ul className="overflow-hidden rounded-xl border border-border">
                    {group.map((b, i) => (
                      <li key={b.id} className={cn(i < group.length - 1 && "border-b border-border")}>
                        <BriefRow brief={b} onOpen={() => setSelectedId(b.id)} />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </main>

      <StaffBriefSheet brief={selected} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function BriefRow({ brief, onOpen }: { brief: StaffBrief; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <span className="shrink-0 rounded-lg bg-muted p-1.5 text-muted-foreground">
        {brief.ad_type === "image_ads" ? <ImageIcon className="h-3.5 w-3.5" aria-hidden /> : <Film className="h-3.5 w-3.5" aria-hidden />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{briefTitle(brief)}</span>
          <StatusPill status={brief.is_template ? "info" : "neutral"}>
            {brief.is_template ? "Template production" : adTypeLabel(brief.ad_type)}
          </StatusPill>
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {[brief.is_template ? null : brief.template_name, brief.ad_angle, brief.offer_type].filter(Boolean).join(" · ")}
        </span>
      </span>
      <span className="hidden shrink-0 space-y-0.5 text-right sm:block">
        {brief.assigned_to
          ? <span className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground"><User className="h-2.5 w-2.5" aria-hidden />{brief.assigned_to}</span>
          : <span className="block text-[11px] italic text-muted-foreground/70">Unassigned</span>}
        <span className="block text-[11px] text-muted-foreground/70">{formatDistanceToNow(new Date(brief.created_at), { addSuffix: true })}</span>
      </span>
      <StatusPill status={STAGE_TONE[brief.status as RequestStatus] ?? "neutral"} className="hidden sm:inline-flex">
        {STATUS_LABEL[brief.status as RequestStatus] ?? brief.status}
      </StatusPill>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />
    </button>
  );
}
