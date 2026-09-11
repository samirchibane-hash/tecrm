import { format } from "date-fns";
import { ClipboardList, ExternalLink, Film, Image as ImageIcon, Layers } from "lucide-react";
import { StatusPill, type Status } from "@/components/StatusPill";
import type { AccountBrief, TemplateBatch } from "./queries";

const BRIEF_STATUS: Record<string, { status: Status; label: string }> = {
  assigned: { status: "neutral", label: "Assigned" },
  reviewing: { status: "info", label: "Reviewing" },
  approved: { status: "warning", label: "Approved" },
  launched: { status: "success", label: "Launched" },
};

function FormatPill({ video }: { video: boolean }) {
  const Icon = video ? Film : ImageIcon;
  return (
    <StatusPill status="neutral" className="gap-1">
      <Icon className="h-3 w-3" aria-hidden />
      {video ? "Video" : "Image"}
    </StatusPill>
  );
}

export function CreativeBriefsList({ briefs }: { briefs: AccountBrief[] }) {
  return (
    <section aria-labelledby="briefs-heading">
      <h2 id="briefs-heading" className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <ClipboardList className="h-3.5 w-3.5" aria-hidden />
        Creative briefs
        {briefs.length > 0 && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium">{briefs.length}</span>}
      </h2>
      {briefs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No briefs for this client yet. Start one from the Creatives page.
        </p>
      ) : (
        <div className="space-y-2">
          {briefs.map((req) => {
            const s = BRIEF_STATUS[req.status] ?? { status: "neutral" as const, label: req.status };
            return (
              <div key={req.id} className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-3 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={s.status}>{s.label}</StatusPill>
                  <FormatPill video={req.ad_type !== "image_ads"} />
                  <span className="text-sm font-medium text-foreground">{req.template_name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{format(new Date(req.updated_at), "MMM d, yyyy")}</span>
                </div>
                <p className="text-xs text-muted-foreground">{req.ad_angle} · {req.offer_type}</p>
                {req.notes && <p className="whitespace-pre-wrap text-xs text-foreground/80">{req.notes}</p>}
                {req.gdrive_folder_url && (
                  <a href={req.gdrive_folder_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    <ExternalLink className="h-3 w-3" /> View creative folder
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function CreativeTemplatesGrid({ batches }: { batches: TemplateBatch[] }) {
  return (
    <section aria-labelledby="templates-heading">
      <h2 id="templates-heading" className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Creative templates</h2>
      {batches.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-14 text-center">
          <Layers className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No creative templates produced for this client yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {batches.map(({ name, previewImage, templateType, templateLink, myLink }) => (
            <div key={name} className="flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
              <div className="flex aspect-video items-center justify-center overflow-hidden bg-muted">
                {previewImage ? (
                  <img src={previewImage} alt={name} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <ImageIcon className="h-8 w-8 text-muted-foreground/25" />
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-3">
                <div>
                  <p className="text-sm font-semibold leading-snug text-foreground">{name}</p>
                  {templateType && <div className="mt-1"><FormatPill video={templateType === "video"} /></div>}
                </div>
                <div className="mt-auto flex flex-col gap-1">
                  {myLink && (
                    <a href={myLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-muted/60">
                      <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                      Open in Drive
                    </a>
                  )}
                  {templateLink && (
                    <a href={templateLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground">
                      <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                      Template source
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
