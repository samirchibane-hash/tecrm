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

// Creative request stages are the shared pipeline stages (see src/lib/stages.ts),
// re-exported under the STATUS_* names this feature already uses.
import { STAGE_STEPS, STAGE_LABEL, STAGE_BADGE, STAGE_DOT, type Stage } from "@/lib/stages";

export const STATUS_STEPS = STAGE_STEPS;
export type RequestStatus = Stage;
export const STATUS_LABEL = STAGE_LABEL;
export const STATUS_BADGE = STAGE_BADGE;
export const STATUS_DOT = STAGE_DOT;
