import { cn } from "@/lib/utils";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Image as ImageIcon, Film, FolderOpen, ExternalLink, ChevronRight } from "lucide-react";
import {
  type CreativeRequest,
  STATUS_LABEL, STATUS_BADGE, STATUS_DOT,
  type RequestStatus,
} from "./types";

const CLIENT_COLORS = [
  "bg-blue-100 text-blue-800",
  "bg-emerald-100 text-emerald-800",
  "bg-amber-100 text-amber-800",
  "bg-purple-100 text-purple-800",
  "bg-rose-100 text-rose-800",
  "bg-cyan-100 text-cyan-800",
  "bg-orange-100 text-orange-800",
  "bg-indigo-100 text-indigo-800",
];

interface TemplateGroup {
  name: string;
  templateType: "image" | "video" | null;
  templateLink: string;
  adAngle: string | null;
  offerType: string | null;
  templateNotes: string | null;
  clients: Record<string, string | null>;
}

interface Props {
  group: TemplateGroup | null;
  requests: CreativeRequest[];
  /** The template's own production request, tracked through the stage pipeline. */
  production: CreativeRequest | null;
  accountColors: Record<string, string>;
  onClose: () => void;
  onSelectRequest: (req: CreativeRequest) => void;
}

export function TemplateDetailSheet({ group, requests, production, accountColors, onClose, onSelectRequest }: Props) {
  if (!group) return null;

  const { name, templateType, templateLink, adAngle, offerType, templateNotes, clients } = group;
  const hasDefaults = !!(adAngle || offerType || templateNotes);

  // Group requests by ad_angle
  const angles = [...new Set(requests.map((r) => r.ad_angle))].sort();
  const byAngle = angles.reduce<Record<string, CreativeRequest[]>>((acc, angle) => {
    acc[angle] = requests.filter((r) => r.ad_angle === angle).sort((a, b) =>
      a.account_name.localeCompare(b.account_name)
    );
    return acc;
  }, {});

  // Client productions without any brief linked
  const clientsWithoutBriefs = Object.entries(clients).filter(
    ([clientName]) => !requests.some((r) => r.account_name === clientName)
  );

  const clientCount = Object.keys(clients).length;
  const doneCount = requests.filter((r) => r.status === "launched").length;

  return (
    <Sheet open={!!group} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <div className="flex items-start gap-3 pr-6">
            <div className={cn(
              "rounded-lg p-2 mt-0.5 shrink-0",
              templateType === "video" ? "bg-violet-50" : "bg-sky-50"
            )}>
              {templateType === "video"
                ? <Film className="h-4 w-4 text-violet-600" />
                : <ImageIcon className="h-4 w-4 text-sky-600" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold text-foreground leading-tight">{name}</h2>
                {templateType && (
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    templateType === "video" ? "bg-violet-100 text-violet-800" : "bg-sky-100 text-sky-800"
                  )}>
                    {templateType === "video" ? "Video" : "Image"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <p className="text-xs text-muted-foreground">
                  {requests.length} brief{requests.length !== 1 ? "s" : ""}
                  {" · "}
                  {clientCount} client{clientCount !== 1 ? "s" : ""}
                  {doneCount > 0 && ` · ${doneCount} done`}
                </p>
                {templateLink && (
                  <a
                    href={templateLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="h-2.5 w-2.5" /> Master template
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Template's own production status */}
          {production && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2.5">
                Production
              </h3>
              <button
                onClick={() => onSelectRequest(production)}
                className="w-full flex items-center gap-3 rounded-xl border border-border px-4 py-3 hover:bg-muted/50 transition-colors text-left group"
              >
                <span
                  className={cn("h-2 w-2 rounded-full shrink-0", STATUS_DOT[production.status as RequestStatus])}
                  title={STATUS_LABEL[production.status as RequestStatus]}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS_BADGE[production.status as RequestStatus])}>
                      {STATUS_LABEL[production.status as RequestStatus]}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {production.status === "launched"
                        ? "Official — ready to brief to clients"
                        : "In production — not yet official"}
                    </span>
                  </div>
                  {production.assigned_to && (
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">{production.assigned_to}</p>
                  )}
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0 group-hover:text-muted-foreground/60 transition-colors" />
              </button>
            </section>
          )}

          {/* Template production defaults */}
          {hasDefaults && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2.5">
                Template Defaults
              </h3>
              <div className="rounded-xl border border-border px-4 py-3 space-y-2">
                {(adAngle || offerType) && (
                  <div className="flex flex-wrap gap-1.5">
                    {adAngle && (
                      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        Angle · {adAngle}
                      </span>
                    )}
                    {offerType && (
                      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        Offer · {offerType}
                      </span>
                    )}
                  </div>
                )}
                {templateNotes && (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{templateNotes}</p>
                )}
              </div>
            </section>
          )}

          {requests.length === 0 && clientsWithoutBriefs.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-10">
              No briefs or clients linked to this template yet.
            </p>
          )}

          {/* Briefs grouped by ad angle */}
          {angles.map((angle) => (
            <section key={angle}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2.5">
                {angle}
              </h3>
              <div className="rounded-xl border border-border overflow-hidden divide-y divide-border/60">
                {byAngle[angle].map((req) => {
                  const driveUrl = req.gdrive_folder_url ?? clients[req.account_name] ?? null;
                  const clientColor = accountColors[req.account_name] ?? CLIENT_COLORS[0];
                  return (
                    <button
                      key={req.id}
                      onClick={() => onSelectRequest(req)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left group"
                    >
                      {/* Status dot */}
                      <span
                        className={cn("h-2 w-2 rounded-full shrink-0", STATUS_DOT[req.status as RequestStatus])}
                        title={STATUS_LABEL[req.status as RequestStatus]}
                      />

                      {/* Client + details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                          <span className={cn("inline-flex rounded-full px-1.5 py-px text-[10px] font-semibold leading-tight", clientColor)}>
                            {req.account_name}
                          </span>
                          <span className={cn("rounded-full px-1.5 py-px text-[10px] font-semibold", STATUS_BADGE[req.status as RequestStatus])}>
                            {STATUS_LABEL[req.status as RequestStatus]}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate leading-tight">
                          {req.offer_type}
                          {req.assigned_to && <span className="opacity-60"> · {req.assigned_to}</span>}
                        </p>
                      </div>

                      {/* Drive link */}
                      {driveUrl ? (
                        <a
                          href={driveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title="Open Drive folder"
                          className="shrink-0 p-1.5 rounded-md text-muted-foreground/40 hover:text-primary hover:bg-muted transition-colors"
                        >
                          <FolderOpen className="h-4 w-4" />
                        </a>
                      ) : (
                        <span className="shrink-0 p-1.5 text-muted-foreground/15" title="No Drive folder yet">
                          <FolderOpen className="h-4 w-4" />
                        </span>
                      )}

                      {/* Chevron */}
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0 group-hover:text-muted-foreground/60 transition-colors" />
                    </button>
                  );
                })}
              </div>
            </section>
          ))}

          {/* Client productions with no brief yet */}
          {clientsWithoutBriefs.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2.5">
                Client Productions
              </h3>
              <div className="rounded-xl border border-border overflow-hidden divide-y divide-border/60">
                {clientsWithoutBriefs.map(([clientName, driveUrl]) => {
                  const colorClass = accountColors[clientName] ?? CLIENT_COLORS[0];
                  return (
                    <div key={clientName} className="flex items-center gap-3 px-4 py-3">
                      <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold", colorClass)}>
                        {clientName}
                      </span>
                      <span className="text-[11px] text-muted-foreground">No brief yet</span>
                      <span className="flex-1" />
                      {driveUrl ? (
                        <a
                          href={driveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open Drive folder"
                          className="shrink-0 p-1.5 rounded-md text-muted-foreground/40 hover:text-primary hover:bg-muted transition-colors"
                        >
                          <FolderOpen className="h-4 w-4" />
                        </a>
                      ) : (
                        <span className="shrink-0 p-1.5 text-muted-foreground/15">
                          <FolderOpen className="h-4 w-4" />
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

        </div>
      </SheetContent>
    </Sheet>
  );
}
