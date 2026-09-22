// Where a Meta ad sends people, read from whichever creative shape it uses.
// One definition, shared by meta-creative-performance (per-ad destination) and
// staff-client-pages (a client's active landing pages).

// Raw Graph JSON; fields are read defensively.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Graph = Record<string, any>;

// Instant-form ads carry a placeholder link, not a page anyone lands on.
export const isRealDestination = (u: string) =>
  /^https?:\/\//i.test(u) && !/^https?:\/\/(www\.)?(fb\.me|facebook\.com|m\.facebook\.com)\b/i.test(u);

export function destinationUrls(creative: Graph | undefined): string[] {
  const oss = creative?.object_story_spec ?? {};
  const link = oss.link_data ?? {};
  const video = oss.video_data ?? {};
  const afs = creative?.asset_feed_spec ?? {};
  const urls = [
    link.link,
    link.call_to_action?.value?.link,
    video.call_to_action?.value?.link,
    ...(afs.link_urls ?? []).map((u: Graph) => u?.website_url),
  ];
  return [...new Set(urls.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean))]
    .filter(isRealDestination);
}

/**
 * Compare page URLs the way a person would: scheme, www., case, query string,
 * fragment and a trailing slash don't make a different page. Mirrors
 * normalizePageUrl() in src/lib/urls.ts, since ad destinations carry UTM
 * parameters and funnel links don't.
 */
export function normalizePageUrl(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/[?#].*$/, "")
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}
