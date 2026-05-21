export type CreativeRequest = {
  id: string;
  account_name: string;
  ad_type: string;
  template_name: string;
  ad_angle: string;
  offer_type: string;
  notes: string | null;
  status: string;
  assigned_to: string | null;
  created_by: string | null;
  gdrive_folder_url: string | null;
  created_at: string;
  updated_at: string;
};

export type RequestComment = {
  id: string;
  request_id: string;
  author: string;
  body: string;
  created_at: string;
};

export const STATUS_STEPS = ["requested", "in_progress", "in_review", "done"] as const;
export type RequestStatus = typeof STATUS_STEPS[number];

export const STATUS_LABEL: Record<RequestStatus, string> = {
  requested: "Requested",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
};

export const STATUS_BADGE: Record<RequestStatus, string> = {
  requested: "bg-blue-100 text-blue-800",
  in_progress: "bg-amber-100 text-amber-800",
  in_review: "bg-orange-100 text-orange-800",
  done: "bg-emerald-100 text-emerald-800",
};

export const STATUS_DOT: Record<RequestStatus, string> = {
  requested: "bg-blue-400",
  in_progress: "bg-amber-400",
  in_review: "bg-orange-400",
  done: "bg-emerald-500",
};

export function nextStatus(s: string): RequestStatus | null {
  if (s === "requested") return "in_progress";
  if (s === "in_progress") return "in_review";
  if (s === "in_review") return "done";
  return null;
}

export function nextStatusLabel(s: string): string | null {
  if (s === "requested") return "Start Working";
  if (s === "in_progress") return "Submit for Review";
  if (s === "in_review") return "Approve";
  return null;
}
