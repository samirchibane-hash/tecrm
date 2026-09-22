import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { Status } from "@/components/StatusPill";
import type { RequestStatus } from "@/components/creatives/types";

export type StaffBrief = Database["public"]["Functions"]["staff_creative_briefs"]["Returns"][number];

/** Thrown when the token doesn't match the current staff link (rotated or mistyped). */
export class InvalidStaffLinkError extends Error {}

// The staff page reads briefs only through the staff_creative_briefs RPC, which
// checks the token server-side and returns a fixed column set. The token is an
// argument, not a header, so the plain client works whether or not the viewer
// happens to be signed in to the CRM.
export function useStaffBriefs(token: string) {
  return useQuery({
    queryKey: ["staff-briefs", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("staff_creative_briefs", { p_token: token });
      if (error) {
        // 28000 = invalid token; 22P02 = not a UUID at all.
        if (error.code === "28000" || error.code === "22P02") throw new InvalidStaffLinkError(error.message);
        throw error;
      }
      return (data ?? []) as StaffBrief[];
    },
    enabled: !!token,
    retry: (count, err) => !(err instanceof InvalidStaffLinkError) && count < 2,
    refetchOnWindowFocus: true,
  });
}

// Stage tones for the shared StatusPill. Launched is finished work, so it
// recedes rather than reading as a success state that needs attention.
export const STAGE_TONE: Record<RequestStatus, Status> = {
  assigned: "info",
  reviewing: "warning",
  approved: "success",
  launched: "neutral",
};

export const adTypeLabel = (adType: string) => (adType === "image_ads" ? "Image Ads" : "Video Ads");

/** A brief's title: the client, or the template name for master-template production. */
export const briefTitle = (b: StaffBrief) => (b.is_template ? b.template_name : b.account_name);
