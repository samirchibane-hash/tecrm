/**
 * Value written to funnel_sites.ghl_inbound_webhook_url.
 * Blank clears the column. Anything else must be an https URL, stored trimmed
 * and otherwise unchanged so a webhook token is not rewritten.
 */
export function webhookUrlToStore(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter an https webhook URL");
  }
  if (url.protocol !== "https:") throw new Error("Webhook URL must start with https://");
  return value;
}
