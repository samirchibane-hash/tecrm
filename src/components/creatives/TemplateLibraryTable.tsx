import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Image as ImageIcon, Film, MoreVertical, Camera, Info, Plus, Trash2, ExternalLink,
} from "lucide-react";
import { type CreativeRequest, STATUS_LABEL, type RequestStatus } from "./types";

export interface TemplateRow {
  name: string;
  previewImage: string | null;
  templateType: "image" | "video" | null;
  templateLink: string;
  /** client name → Drive folder url (or null when the production has no link) */
  clients: Record<string, string | null>;
}

/**
 * What a single template × client cell means. These are four distinct states —
 * "not produced" must never render the same as "produced, no brief".
 */
type CellState =
  | { kind: "none" }
  | { kind: "produced"; driveUrl: string | null }
  | { kind: "in_progress"; request: CreativeRequest }
  | { kind: "done"; request: CreativeRequest };

interface Props {
  rows: TemplateRow[];
  /** Client accounts that become the columns, in display order. */
  clientColumns: string[];
  requests: CreativeRequest[];
  onOpenTemplate: (row: TemplateRow) => void;
  onOpenRequest: (req: CreativeRequest) => void;
  /** Start a brand-new brief for a template × client pair that has no request yet. */
  onNewBrief: (templateName: string, client: string) => void;
  onUploadThumbnail: (templateName: string) => void;
  onOpenSettings: (row: TemplateRow) => void;
  onAddClient: (templateName: string) => void;
  onDeleteTemplate: (templateName: string) => void;
  uploadingThumbnailFor: string | null;
}

export function TemplateLibraryTable({
  rows, clientColumns, requests,
  onOpenTemplate, onOpenRequest, onNewBrief, onUploadThumbnail, onOpenSettings,
  onAddClient, onDeleteTemplate, uploadingThumbnailFor,
}: Props) {
  // template name → client name → latest request for that pair
  const requestIndex = useMemo(() => {
    const index: Record<string, Record<string, CreativeRequest>> = {};
    requests.forEach((r) => {
      const byClient = (index[r.template_name] ??= {});
      const current = byClient[r.account_name];
      if (!current) { byClient[r.account_name] = r; return; }
      // A launched brief outranks an open one; between equals, the newest wins.
      const rDone = r.status === "launched";
      const currentDone = current.status === "launched";
      if (rDone !== currentDone) {
        if (rDone) byClient[r.account_name] = r;
      } else if (r.created_at > current.created_at) {
        byClient[r.account_name] = r;
      }
    });
    return index;
  }, [requests]);

  const cellState = (templateName: string, client: string, row: TemplateRow): CellState => {
    const req = requestIndex[templateName]?.[client];
    if (req) return req.status === "launched" ? { kind: "done", request: req } : { kind: "in_progress", request: req };
    if (client in row.clients) return { kind: "produced", driveUrl: row.clients[client] };
    return { kind: "none" };
  };

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <th
                scope="col"
                className="sticky left-0 z-20 bg-card border-r border-border px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground min-w-[240px]"
              >
                Template Name
              </th>
              <th scope="col" className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground w-[96px]">
                Type
              </th>
              {clientColumns.map((client) => (
                <th
                  key={client}
                  scope="col"
                  className="px-3 py-2.5 text-left text-xs font-semibold text-foreground whitespace-nowrap min-w-[140px]"
                >
                  {client}
                </th>
              ))}
              <th scope="col" className="w-10 px-1 py-2.5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className="border-b border-border/50 last:border-0 hover:bg-muted/30 group">
                {/* Template name — hover reveals the thumbnail */}
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-card group-hover:bg-muted/30 transition-colors border-r border-border px-4 py-2 text-left font-medium"
                >
                  <HoverCard openDelay={150} closeDelay={80}>
                    <HoverCardTrigger asChild>
                      <button
                        onClick={() => onOpenTemplate(row)}
                        className="max-w-[220px] truncate rounded-sm text-left text-sm text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {row.name}
                      </button>
                    </HoverCardTrigger>
                    <HoverCardContent side="right" align="start" className="w-64 p-2">
                      {uploadingThumbnailFor === row.name ? (
                        <p className="py-8 text-center text-xs text-muted-foreground">Uploading thumbnail…</p>
                      ) : row.previewImage ? (
                        <img
                          src={row.previewImage}
                          alt={`${row.name} thumbnail`}
                          className="w-full rounded-md object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 py-8 text-center">
                          <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
                          <p className="text-xs text-muted-foreground">No thumbnail yet</p>
                        </div>
                      )}
                      {row.templateLink && (
                        <a
                          href={row.templateLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1 px-1 text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-3 w-3" /> Master template
                        </a>
                      )}
                    </HoverCardContent>
                  </HoverCard>
                </th>

                {/* Type */}
                <td className="px-3 py-2">
                  {row.templateType ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {row.templateType === "video"
                        ? <Film className="h-3 w-3" />
                        : <ImageIcon className="h-3 w-3" />}
                      {row.templateType === "video" ? "Video" : "Image"}
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground/50">Not set</span>
                  )}
                </td>

                {/* One cell per client account */}
                {clientColumns.map((client) => (
                  <Cell
                    key={client}
                    state={cellState(row.name, client, row)}
                    templateName={row.name}
                    client={client}
                    onOpenRequest={onOpenRequest}
                    onNewBrief={onNewBrief}
                  />
                ))}

                {/* Row actions */}
                <td className="px-1 py-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                        <MoreVertical className="h-4 w-4" />
                        <span className="sr-only">Actions for {row.name}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onUploadThumbnail(row.name)}>
                        <Camera className="mr-2 h-3.5 w-3.5" />
                        {row.previewImage ? "Replace thumbnail" : "Upload thumbnail"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onOpenSettings(row)}>
                        <Info className="mr-2 h-3.5 w-3.5" /> Settings
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onAddClient(row.name)}>
                        <Plus className="mr-2 h-3.5 w-3.5" /> Add client
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => onDeleteTemplate(row.name)}>
                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete template
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend — the fill colors must not be the only thing carrying meaning */}
      <div className="flex flex-wrap items-center gap-4 border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-success" /> Done — launched
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-warning" /> Assigned — brief in progress
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border border-border bg-muted" /> Produced, no brief
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border border-dashed border-border" /> Not produced for this client
        </span>
      </div>
    </div>
  );
}

function Cell({
  state, templateName, client, onOpenRequest, onNewBrief,
}: {
  state: CellState;
  templateName: string;
  client: string;
  onOpenRequest: (r: CreativeRequest) => void;
  onNewBrief: (templateName: string, client: string) => void;
}) {
  // No brief yet (produced or not) — the whole cell briefs this template for this client.
  if (state.kind === "none") {
    return (
      <td className="px-3 py-2">
        <button
          onClick={() => onNewBrief(templateName, client)}
          title={`New brief · ${client}`}
          className="group/cell inline-flex w-full items-center justify-center rounded-md border border-dashed border-transparent px-2 py-1 transition-colors hover:border-border hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="sr-only">Not produced — create brief for {client}</span>
          <span aria-hidden className="text-muted-foreground/30 group-hover/cell:hidden">—</span>
          <Plus aria-hidden className="hidden h-3 w-3 text-muted-foreground group-hover/cell:block" />
        </button>
      </td>
    );
  }

  if (state.kind === "produced") {
    return (
      <td className="px-3 py-2">
        <button
          onClick={() => onNewBrief(templateName, client)}
          title={`Produced, no brief · New brief for ${client}`}
          className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Produced
        </button>
      </td>
    );
  }

  const { request } = state;
  const done = state.kind === "done";
  const label = done ? "DONE" : STATUS_LABEL[request.status as RequestStatus].toUpperCase();

  return (
    <td className="px-3 py-2">
      <button
        onClick={() => onOpenRequest(request)}
        title={request.assigned_to ? `${label} · ${request.assigned_to}` : label}
        className={cn(
          "inline-flex w-full items-center justify-between gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          done ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground",
        )}
      >
        <span>{label}</span>
        {request.assigned_to && (
          <span className="max-w-[64px] truncate font-medium opacity-80">{request.assigned_to}</span>
        )}
      </button>
    </td>
  );
}
