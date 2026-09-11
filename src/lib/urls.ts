/**
 * Compare page URLs the way a person would: scheme, www., case, query string,
 * fragment and a trailing slash don't make a different page. Mirrors the
 * database's normalize_link_url() plus the query/fragment strip, since ad
 * destinations carry UTM parameters and funnel links don't.
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

/** "test.kineticotv.co/meridian-1" → "/meridian-1" (the host when there's no path). */
export function pagePath(normalized: string): string {
  const slash = normalized.indexOf("/");
  return slash === -1 ? normalized : normalized.slice(slash);
}
