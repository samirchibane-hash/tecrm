import { format } from "date-fns";
import { ExternalLink, FolderOpen, LayoutTemplate, FolderKanban, User, Image as ImageIcon, Film, Globe, CalendarCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { normalizePageUrl } from "@/lib/urls";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusPill } from "@/components/StatusPill";
import { STATUS_LABEL, type RequestStatus } from "@/components/creatives/types";
import { STAGE_TONE, adTypeLabel, briefTitle, type StaffBrief, type StaffClientPages } from "./useStaffBriefs";

interface Props {
  brief: StaffBrief | null;
  /** This brief's client pages; undefined while loading, null if they couldn't load. */
  pages: StaffClientPages | null | undefined;
  pagesLoading: boolean;
  onClose: () => void;
}

// Read-only brief for staff. The three links are what a designer needs to start
// work; a missing one says so in words instead of silently disappearing, so
// "not on file" is never mistaken for "not needed".
export function StaffBriefSheet({ brief, pages, pagesLoading, onClose }: Props) {
  return (
    <Sheet open={!!brief} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col overflow-hidden">
        {brief && (
          <>
            <SheetHeader className="px-6 pt-6 pb-4 border-b border-border text-left space-y-2">
              <div className="flex flex-wrap items-center gap-2 pr-8">
                <SheetTitle className="text-base">{briefTitle(brief)}</SheetTitle>
                <StatusPill status={STAGE_TONE[brief.status as RequestStatus] ?? "neutral"}>
                  {STATUS_LABEL[brief.status as RequestStatus] ?? brief.status}
                </StatusPill>
              </div>
              <SheetDescription className="flex items-center gap-1.5 text-xs">
                {brief.ad_type === "image_ads" ? <ImageIcon className="h-3.5 w-3.5" aria-hidden /> : <Film className="h-3.5 w-3.5" aria-hidden />}
                {brief.is_template ? "Master template production" : adTypeLabel(brief.ad_type)}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              <section aria-labelledby="staff-brief-links">
                <h3 id="staff-brief-links" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Links</h3>
                <div className="space-y-2">
                  {!brief.is_template && (
                    <BriefLink
                      icon={FolderOpen}
                      label="Client Drive"
                      detail={`${brief.account_name} — brand assets and past creatives`}
                      href={brief.client_drive_url}
                      missing="No Drive folder on file for this client yet"
                    />
                  )}
                  <BriefLink
                    icon={LayoutTemplate}
                    label="Template"
                    detail={brief.template_name}
                    href={brief.template_link}
                    missing="No link saved on this template yet"
                  />
                  <BriefLink
                    icon={FolderKanban}
                    label="Brief folder"
                    detail="Upload finished creatives here"
                    href={brief.brief_drive_url}
                    missing="No output folder created for this brief yet"
                  />
                </div>
              </section>

              {!brief.is_template && (
                <ClientPagesSection accountName={brief.account_name} pages={pages} loading={pagesLoading} />
              )}

              {brief.template_preview_url && (
                <section aria-labelledby="staff-brief-preview">
                  <h3 id="staff-brief-preview" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Template preview</h3>
                  <img
                    src={brief.template_preview_url}
                    alt={`${brief.template_name} template preview`}
                    className="max-h-72 rounded-lg border border-border bg-muted object-contain"
                    loading="lazy"
                  />
                </section>
              )}

              <section aria-labelledby="staff-brief-details">
                <h3 id="staff-brief-details" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Brief</h3>
                <dl className="rounded-xl border border-border bg-muted/30 divide-y divide-border">
                  {([
                    ["Template", brief.template_name],
                    ["Ad angle", brief.ad_angle],
                    ["Offer", brief.offer_type],
                    ["Assigned to", brief.assigned_to],
                    ["Requested", format(new Date(brief.created_at), "MMM d, yyyy")],
                  ] as [string, string | null][]).map(([label, value]) => (
                    <div key={label} className="flex items-start gap-4 px-4 py-2.5">
                      <dt className="text-xs text-muted-foreground w-24 shrink-0">{label}</dt>
                      <dd className={value ? "text-xs font-medium text-foreground" : "text-xs italic text-muted-foreground"}>
                        {label === "Assigned to" && value ? (
                          <span className="inline-flex items-center gap-1"><User className="h-3 w-3" aria-hidden />{value}</span>
                        ) : value || (label === "Assigned to" ? "Unassigned" : "—")}
                      </dd>
                    </div>
                  ))}
                  {brief.notes && (
                    <div className="px-4 py-2.5">
                      <dt className="text-xs text-muted-foreground mb-1">Notes</dt>
                      <dd className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{brief.notes}</dd>
                    </div>
                  )}
                </dl>
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

const isHomePage = (url: string) => !normalizePageUrl(url).includes("/");

const META_UNAVAILABLE: Record<Exclude<StaffClientPages["meta"], "ok">, string> = {
  not_linked: "This client's Meta ad account isn't linked in the CRM, so live pages can't be shown",
  no_access: "Can't read this client's Meta ad account right now, so live pages can't be shown",
  error: "Couldn't reach Meta right now, so live pages can't be shown",
};

// The pages this client's ads send people to right now, and where they book.
// Every gap is named: unknown (Meta unreadable) is never shown as "no pages".
function ClientPagesSection({ accountName, pages, loading }: {
  accountName: string;
  pages: StaffClientPages | null | undefined;
  loading: boolean;
}) {
  // A bare domain only redirects to the funnel's first landing page, so it isn't
  // a page staff need to open.
  const landingPages = (pages?.activePages ?? []).filter((p) => !isHomePage(p.url));
  return (
    <section aria-labelledby="staff-brief-pages">
      <h3 id="staff-brief-pages" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Landing pages</h3>
      {loading ? (
        <div className="space-y-2" role="status" aria-label="Loading landing pages">
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
        </div>
      ) : !pages ? (
        <p className="text-xs text-muted-foreground">Couldn't load {accountName}'s landing pages. Reload the page to try again.</p>
      ) : (
        <div className="space-y-2">
          {pages.meta !== "ok" ? (
            <BriefLink icon={Globe} label="Active landing pages" detail="" href={null} missing={META_UNAVAILABLE[pages.meta]} />
          ) : landingPages.length === 0 ? (
            <BriefLink
              icon={Globe}
              label="Active landing pages"
              detail=""
              href={null}
              missing={pages.activePages.length === 0
                ? "No ads are live for this client right now"
                : "Live ads point to the site's home page, not a specific landing page"}
            />
          ) : (
            landingPages.map((p) => (
              <BriefLink
                key={p.url}
                icon={Globe}
                label={p.label}
                detail={p.url.replace(/^https?:\/\//, "")}
                href={p.url}
                missing=""
              />
            ))
          )}
          {pages.schedulePages.length === 0 ? (
            <BriefLink icon={CalendarCheck} label="Schedule page" detail="" href={null} missing="No schedule page found in this client's funnel" />
          ) : (
            pages.schedulePages.map((p) => (
              <BriefLink
                key={p.url}
                icon={CalendarCheck}
                label={pages.schedulePages.length > 1 ? `Schedule page · ${p.label}` : "Schedule page"}
                detail={p.url.replace(/^https?:\/\//, "")}
                href={p.url}
                missing=""
              />
            ))
          )}
        </div>
      )}
    </section>
  );
}

function BriefLink({ icon: Icon, label, detail, href, missing }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  detail: string;
  href: string | null;
  missing: string;
}) {
  if (!href) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-dashed border-border px-3 py-2.5">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground/60" />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground">{label}</p>
          <p className="text-[11px] text-muted-foreground">{missing}</p>
        </div>
      </div>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon className="h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-foreground">{label}</p>
        <p className="truncate text-[11px] text-muted-foreground">{detail}</p>
      </div>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" aria-hidden />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
