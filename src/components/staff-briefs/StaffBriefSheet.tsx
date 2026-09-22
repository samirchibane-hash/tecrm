import { format } from "date-fns";
import {
  CircleCheck, ExternalLink, FolderOpen, FolderUp, Globe, CalendarCheck, Building2,
  Image as ImageIcon, Film, User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusPill } from "@/components/StatusPill";
import { STATUS_LABEL, type RequestStatus } from "@/components/creatives/types";
import { normalizePageUrl } from "@/lib/urls";
import { cn } from "@/lib/utils";
import { STAGE_TONE, adTypeLabel, type StaffBrief, type StaffClientPages } from "./useStaffBriefs";

interface Props {
  brief: StaffBrief | null;
  /** This brief's client pages; undefined while loading, null if they couldn't load. */
  pages: StaffClientPages | null | undefined;
  pagesLoading: boolean;
  onClose: () => void;
}

// Read-only brief for staff, laid out in the order a designer works: who the
// client is and where their material lives, then what to make, then — pinned at
// the bottom so it's always in reach — where finished work goes. A missing link
// says so in words instead of disappearing, so "not on file" is never mistaken
// for "not needed".
export function StaffBriefSheet({ brief, pages, pagesLoading, onClose }: Props) {
  return (
    <Sheet open={!!brief} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col gap-0 overflow-hidden">
        {brief && (
          <>
            <SheetHeader className="px-6 pt-6 pb-5 border-b border-border text-left space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {brief.is_template ? "Master template production" : "Creative brief"}
              </p>
              <SheetTitle className="pr-8 text-lg leading-snug">{brief.template_name}</SheetTitle>
              <SheetDescription asChild>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <StatusPill status={STAGE_TONE[brief.status as RequestStatus] ?? "neutral"}>
                    {STATUS_LABEL[brief.status as RequestStatus] ?? brief.status}
                  </StatusPill>
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    {brief.ad_type === "image_ads" ? <ImageIcon className="h-3.5 w-3.5" aria-hidden /> : <Film className="h-3.5 w-3.5" aria-hidden />}
                    {adTypeLabel(brief.ad_type)}
                  </span>
                  <span className="text-xs text-muted-foreground" aria-hidden>·</span>
                  <span className="text-xs text-muted-foreground">Requested {format(new Date(brief.created_at), "MMM d")}</span>
                </div>
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-7">
              {!brief.is_template && <ClientSection brief={brief} pages={pages} loading={pagesLoading} />}
              <BriefSection brief={brief} />
            </div>

            <DeliverFooter href={brief.brief_drive_url} />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Client: name, Drive, funnel ─────────────────────────────────────────────

const isHomePage = (url: string) => !normalizePageUrl(url).includes("/");
const displayUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "");

const META_UNAVAILABLE: Record<Exclude<StaffClientPages["meta"], "ok">, string> = {
  not_linked: "Meta ad account isn't linked in the CRM",
  no_access: "Can't read this client's Meta ad account right now",
  error: "Couldn't reach Meta right now",
};

function ClientSection({ brief, pages, loading }: {
  brief: StaffBrief;
  pages: StaffClientPages | null | undefined;
  loading: boolean;
}) {
  // A bare domain only redirects to the funnel's first landing page, so it isn't
  // a page staff need to open.
  const landingPages = (pages?.activePages ?? []).filter((p) => !isHomePage(p.url));

  return (
    <Section id="staff-brief-client" title="Client">
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-4 py-3">
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="text-sm font-semibold text-foreground">{brief.account_name}</p>
        </div>

        <ul className="divide-y divide-border">
          <LinkRow
            icon={FolderOpen}
            label="Client Drive"
            detail="Logos, brand assets and past creatives"
            href={brief.client_drive_url}
            missing="No Drive folder on file yet"
          />

          {loading ? (
            <li className="space-y-2 px-4 py-3" role="status" aria-label="Loading funnel pages">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </li>
          ) : !pages ? (
            <LinkRow icon={Globe} label="Landing pages" href={null} missing="Couldn't load funnel pages — reload to try again" />
          ) : (
            <>
              {pages.meta !== "ok" ? (
                <LinkRow icon={Globe} label="Landing page" href={null} missing={`${META_UNAVAILABLE[pages.meta]}, so live pages can't be shown`} />
              ) : landingPages.length === 0 ? (
                <LinkRow
                  icon={Globe}
                  label="Landing page"
                  href={null}
                  missing={pages.activePages.length === 0
                    ? "No ads are live right now"
                    : "Live ads point to the home page, not a specific landing page"}
                />
              ) : (
                landingPages.map((p) => (
                  <LinkRow key={p.url} icon={Globe} label={p.label} eyebrow="Live landing page" detail={displayUrl(p.url)} href={p.url} />
                ))
              )}

              {pages.schedulePages.length === 0 ? (
                <LinkRow icon={CalendarCheck} label="Schedule page" href={null} missing="No schedule page in this client's funnel" />
              ) : (
                pages.schedulePages.map((p) => (
                  <LinkRow
                    key={p.url}
                    icon={CalendarCheck}
                    label={pages.schedulePages.length > 1 ? p.label : "Schedule page"}
                    eyebrow={pages.schedulePages.length > 1 ? "Schedule page" : undefined}
                    detail={displayUrl(p.url)}
                    href={p.url}
                  />
                ))
              )}
            </>
          )}
        </ul>
      </div>
    </Section>
  );
}

// ─── Brief: what to make ─────────────────────────────────────────────────────

function BriefSection({ brief }: { brief: StaffBrief }) {
  const rows: [string, React.ReactNode][] = [
    ["Ad angle", brief.ad_angle || null],
    ["Offer", brief.offer_type || null],
    ["Assigned to", brief.assigned_to
      ? <span className="inline-flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />{brief.assigned_to}</span>
      : null],
  ];

  return (
    <Section id="staff-brief-details" title="Brief">
      <dl className="overflow-hidden rounded-xl border border-border bg-card divide-y divide-border">
        <div className="px-4 py-3.5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Template</dt>
              <dd className="mt-0.5 text-sm font-semibold text-foreground">{brief.template_name}</dd>
            </div>
            {brief.template_link ? (
              <Button asChild variant="outline" size="sm" className="shrink-0 gap-1.5">
                <a href={brief.template_link} target="_blank" rel="noopener noreferrer">
                  Open template <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </Button>
            ) : (
              <span className="shrink-0 pt-0.5 text-[11px] italic text-muted-foreground">No template link saved yet</span>
            )}
          </div>

          {brief.template_preview_url && (
            <TemplatePreview src={brief.template_preview_url} href={brief.template_link} name={brief.template_name} />
          )}
        </div>

        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline gap-4 px-4 py-2.5">
            <dt className="w-24 shrink-0 text-xs text-muted-foreground">{label}</dt>
            <dd className={cn("min-w-0 text-sm", value ? "font-medium text-foreground" : "italic text-muted-foreground")}>
              {value ?? (label === "Assigned to" ? "Unassigned" : "Not specified")}
            </dd>
          </div>
        ))}

        {brief.notes && (
          <div className="px-4 py-3">
            <dt className="mb-1 text-xs text-muted-foreground">Notes</dt>
            <dd className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{brief.notes}</dd>
          </div>
        )}
      </dl>
    </Section>
  );
}

function TemplatePreview({ src, href, name }: { src: string; href: string | null; name: string }) {
  const img = (
    <img
      src={src}
      alt={`${name} template preview`}
      loading="lazy"
      className="max-h-52 w-full rounded-lg border border-border bg-muted object-contain"
    />
  );
  if (!href) return img;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {img}
      <span className="sr-only">Open template (opens in a new tab)</span>
    </a>
  );
}

// ─── Deliver: the last step, always in reach ─────────────────────────────────

function DeliverFooter({ href }: { href: string | null }) {
  return (
    // Ready = success green, so the delivery step stands out from the rest of
    // the panel; no folder yet stays neutral.
    <div className={cn("shrink-0 border-t px-6 py-4", href ? "border-success/40 bg-success/10" : "border-border bg-muted/40")}>
      {href ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Finished?</p>
              <p className="text-xs text-muted-foreground">Upload completed assets to this brief's folder.</p>
            </div>
          </div>
          <Button asChild className="shrink-0 gap-2 bg-success text-success-foreground hover:bg-success/90">
            <a href={href} target="_blank" rel="noopener noreferrer">
              <FolderUp className="h-4 w-4" aria-hidden /> Open brief folder
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </Button>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <FolderUp className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-foreground">No brief folder yet</p>
            <p className="text-xs text-muted-foreground">Ask your Treat Engine contact to create one before uploading completed assets.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shared pieces ───────────────────────────────────────────────────────────

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function LinkRow({ icon: Icon, label, eyebrow, detail, href, missing }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  eyebrow?: string;
  detail?: string;
  href: string | null;
  missing?: string;
}) {
  if (!href) {
    return (
      <li className="flex items-center gap-3 px-4 py-3">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground/50" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-xs italic text-muted-foreground">{missing}</p>
        </div>
      </li>
    );
  }
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <Icon className="h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          {eyebrow && <p className="text-[11px] text-muted-foreground">{eyebrow}</p>}
          <p className="text-sm font-medium text-foreground">{label}</p>
          {detail && <p className="truncate text-xs text-muted-foreground">{detail}</p>}
        </div>
        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" aria-hidden />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    </li>
  );
}
