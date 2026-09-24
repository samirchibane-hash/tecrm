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

/**
 * An href that leaves the app. Clients type "www.site.com" without a scheme, and
 * a bare host is a relative link: on /account/X it opens /account/www.site.com.
 */
export function externalHref(url: string): string {
  const trimmed = url.trim();
  return /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed.replace(/^\/+/, "")}`;
}
