import { supabase } from "@/integrations/supabase/client";
import { personNameFromUser } from "@/lib/taskCompletion";

/**
 * Who is marking the task done, from the signed-in profile.
 * Returns null when the profile has no name — the address is not shown as a person.
 * A bot writing tasks with the service role has no session; it sets completed_by itself.
 */
export async function currentCompleterName(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return personNameFromUser(data.session?.user ?? null);
}
