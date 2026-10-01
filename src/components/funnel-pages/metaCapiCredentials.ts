/**
 * Value written to funnel_sites.meta_dataset_id and meta_access_token.
 * Blank clears the column. Anything else is stored trimmed and otherwise
 * unchanged — a CAPI token must not be rewritten.
 */
export function metaCredentialToStore(raw: string): string | null {
  const value = raw.trim();
  return value ? value : null;
}
