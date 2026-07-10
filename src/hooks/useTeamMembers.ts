import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TeamMember {
  id: string;
  name: string;
  position: string | null;
  created_at: string;
}

// Shared roster of team members configured in Settings. Used to populate the
// "Assign to" dropdowns on Creative Requests and Tasks. Assignments are stored
// as the member's name (not id), matching the existing free-text convention.
export function useTeamMembers() {
  const query = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []) as TeamMember[];
    },
  });

  return {
    members: query.data ?? [],
    isLoading: query.isLoading,
  };
}
