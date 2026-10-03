import { format } from "date-fns";
import { ExternalLink, Film, Image as ImageIcon } from "lucide-react";
import { StatusPill } from "@/components/StatusPill";
import { CATEGORY_CHART_COLOR, CATEGORY_LABEL, CREATIVE_STATUS } from "./reportConfig";
import type { TimelineItem } from "./timeline";

/** Turns URLs inside free text into links. */
function linkify(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /https?:\/\/[^\s]+/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <a key={m.index} href={m[0]} target="_blank" rel="noopener noreferrer" className="break-all text-primary hover:underline">
        {m[0]}
      </a>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "View link";
  }
}

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline">
      {children}
      <ExternalLink className="h-3 w-3" aria-hidden />
    </a>
  );
}

const itemDate = (item: TimelineItem) =>
  // A creative batch's date may be a bare launch day; read it as local time.
  new Date(item.date.length === 10 ? `${item.date}T00:00:00` : item.date);

export function ReportChangeLog({ items }: { items: TimelineItem[] }) {
  return (
    <section id="changes" aria-labelledby="changes-h" className="scroll-mt-16 space-y-4">
      <div className="space-y-0.5">
        <h2 id="changes-h" className="text-[22px] font-semibold tracking-tight text-foreground">What we changed</h2>
        <p className="text-sm text-muted-foreground">
          {items.length} update{items.length === 1 ? "" : "s"} in this period
        </p>
      </div>
      <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
        {items.map((item) => (
          <li key={key(item)} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 px-4 py-4 sm:grid-cols-[88px_auto_minmax(0,1fr)] sm:px-5">
            <time
              dateTime={item.date}
              className="col-span-2 mb-1 text-xs tabular-nums text-muted-foreground sm:col-span-1 sm:mb-0 sm:pt-0.5 sm:text-[13px]"
            >
              {format(itemDate(item), "MMM d, yyyy")}
            </time>
            <span aria-hidden className="flex justify-center pt-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: dotColor(item) }} />
            </span>
            <div className="min-w-0 space-y-1.5">
              <Entry item={item} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function key(item: TimelineItem) {
  if (item.type === "update") return `u-${item.data.id}`;
  if (item.type === "creative-request") return `r-${item.data.id}`;
  return `b-${item.batchName}`;
}

function dotColor(item: TimelineItem) {
  const category = item.type === "update" ? item.data.category : "creative_swap";
  return CATEGORY_CHART_COLOR[category] ?? CATEGORY_CHART_COLOR.other;
}

function Entry({ item }: { item: TimelineItem }) {
  if (item.type === "update") {
    const u = item.data;
    const category = CATEGORY_LABEL[u.category] ?? u.category;
    return (
      <>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="text-[15px] font-semibold text-foreground">{u.title || category}</h3>
          <StatusPill status="neutral">{category}</StatusPill>
        </div>
        <p className="text-[13px] text-muted-foreground">{u.campaign_name}</p>
        {u.details && <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{linkify(u.details)}</p>}
        {u.image_url && (
          <div className="flex flex-wrap gap-2 pt-1">
            {u.image_url.split(",").map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <img src={url} alt={`Attachment ${i + 1}`} loading="lazy" className="max-h-32 max-w-[160px] rounded-lg border border-border object-cover" />
              </a>
            ))}
          </div>
        )}
        {u.link_url && <ExtLink href={u.link_url}>{hostname(u.link_url)}</ExtLink>}
      </>
    );
  }

  if (item.type === "creative-request") {
    const req = item.data;
    const status = CREATIVE_STATUS[req.status] ?? { label: req.status, status: "neutral" as const };
    const isImage = req.ad_type === "image_ads";
    const TypeIcon = isImage ? ImageIcon : Film;
    return (
      <>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="text-[15px] font-semibold text-foreground">{req.template_name}</h3>
          <StatusPill status={status.status}>{status.label}</StatusPill>
          <StatusPill status="neutral" className="gap-1">
            <TypeIcon className="h-3 w-3" aria-hidden />
            {isImage ? "Image ad" : "Video ad"}
          </StatusPill>
        </div>
        <p className="text-sm text-foreground">
          {req.ad_angle} · {req.offer_type}
        </p>
        {req.notes && <p className="whitespace-pre-wrap text-[13px] text-muted-foreground">{req.notes}</p>}
        {req.gdrive_folder_url && <ExtLink href={req.gdrive_folder_url}>View creative folder</ExtLink>}
      </>
    );
  }

  const links = item.items.filter((c) => c.file_type === "link");
  const images = item.items.filter((c) => c.file_type !== "link");
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h3 className="text-[15px] font-semibold text-foreground">{item.batchName}</h3>
        <StatusPill status="neutral">New creative</StatusPill>
      </div>
      {links.length > 0 && (
        <div className="flex flex-col items-start gap-1">
          {links.map((l) => (
            <ExtLink key={l.id} href={l.file_url}>{l.file_name}</ExtLink>
          ))}
        </div>
      )}
      {images.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 pt-1">
          {images.map((img) => (
            <a key={img.id} href={img.file_url} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <img src={img.file_url} alt={img.file_name} loading="lazy" className="h-20 rounded-lg border border-border" />
            </a>
          ))}
        </div>
      )}
    </>
  );
}
