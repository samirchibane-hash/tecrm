import { supabase } from "@/integrations/supabase/client";
import type { OpsOutcome } from "./workStream";

/**
 * Smallest write path for an ops outcome on the shared work stream.
 * Caller must be an admin session (or service role, if this client is one).
 * `writer` is the person who closed the work, not a bot name.
 * Pass `dedupeKey` to make a retry return the existing row.
 */
export async function recordOpsOutcome(input: {
  accountId: string;
  outcome: OpsOutcome;
  writer: string;
  summary: string;
  detail?: string | null;
  occurredAt?: string;
  dedupeKey?: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc("record_ops_outcome", {
    p_account_id: input.accountId,
    p_outcome: input.outcome,
    p_writer: input.writer,
    p_summary: input.summary,
    p_detail: input.detail ?? undefined,
    p_occurred_at: input.occurredAt,
    p_dedupe_key: input.dedupeKey ?? undefined,
  });
  if (error) throw error;
  if (!data) throw new Error("record_ops_outcome returned no id");
  return data;
}
