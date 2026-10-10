import { supabase } from "@/integrations/supabase/client";
import { completerName, personNameFromUser } from "@/lib/taskCompletion";

/**
 * Who is marking the task done.
 * The auth profile name wins. Otherwise the team roster: the longest first name
 * the email's local part starts with (the admin mailbox matches Samir).
 * A bot has no session. It writes public.tasks.completed_by itself — see CLAUDE.md.
 */
export async function currentCompleterName(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user ?? null;
  const profile = personNameFromUser(user);
  if (profile) return profile;
  const { data: members, error } = await supabase.from("team_members").select("name");
  if (error) return null;
  return completerName({
    profileName: null,
    email: user?.email,
    roster: (members ?? []).map((member) => member.name),
  });
}
