// Meta's effective_status in the words an operator uses. Its own module so both
// the shared creative components and the gallery can read it without a
// component file exporting non-components (fast refresh).

const STATUS_TEXT: Record<string, string> = {
  ACTIVE: "Live",
  PAUSED: "Paused",
  ADSET_PAUSED: "Ad set paused",
  CAMPAIGN_PAUSED: "Campaign paused",
  ARCHIVED: "Archived",
  DELETED: "Deleted",
  WITH_ISSUES: "Has issues",
  DISAPPROVED: "Disapproved",
  PENDING_REVIEW: "In review",
  IN_PROCESS: "Processing",
};

export const deliveryStatusText = (status: string) =>
  STATUS_TEXT[status] ?? status.toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
