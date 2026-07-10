// Shared pipeline stages used by both Creative Requests and Tasks so the two
// features present the exact same field. Values are persisted to the DB
// (`creative_requests.status`, `tasks.stage`) and guarded by CHECK constraints.

export const STAGE_STEPS = ["assigned", "reviewing", "approved", "launched"] as const;
export type Stage = typeof STAGE_STEPS[number];

export const STAGE_LABEL: Record<Stage, string> = {
  assigned: "Assigned",
  reviewing: "Reviewing",
  approved: "Approved",
  launched: "Launched",
};

export const STAGE_BADGE: Record<Stage, string> = {
  assigned: "bg-blue-100 text-blue-800",
  reviewing: "bg-amber-100 text-amber-800",
  approved: "bg-orange-100 text-orange-800",
  launched: "bg-emerald-100 text-emerald-800",
};

export const STAGE_DOT: Record<Stage, string> = {
  assigned: "bg-blue-400",
  reviewing: "bg-amber-400",
  approved: "bg-orange-400",
  launched: "bg-emerald-500",
};
