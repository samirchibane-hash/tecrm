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

export const STATUS_STEPS = ["assigned", "reviewing", "approved", "launched"] as const;
export type RequestStatus = typeof STATUS_STEPS[number];

export const STATUS_LABEL: Record<RequestStatus, string> = {
  assigned: "Assigned",
  reviewing: "Reviewing",
  approved: "Approved",
  launched: "Launched",
};

export const STATUS_BADGE: Record<RequestStatus, string> = {
  assigned: "bg-blue-100 text-blue-800",
  reviewing: "bg-amber-100 text-amber-800",
  approved: "bg-orange-100 text-orange-800",
  launched: "bg-emerald-100 text-emerald-800",
};

export const STATUS_DOT: Record<RequestStatus, string> = {
  assigned: "bg-blue-400",
  reviewing: "bg-amber-400",
  approved: "bg-orange-400",
  launched: "bg-emerald-500",
};
