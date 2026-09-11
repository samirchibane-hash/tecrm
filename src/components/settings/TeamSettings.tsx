import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { toast } from "sonner";

export function TeamSettings() {
  const queryClient = useQueryClient();
  const { members: teamMembers } = useTeamMembers();
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberPosition, setNewMemberPosition] = useState("");

  const addMember = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("team_members").insert({
        name: newMemberName.trim(),
        position: newMemberPosition.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      setNewMemberName("");
      setNewMemberPosition("");
      toast.success("Team member added");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("team_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast.success("Team member removed");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <p className="text-sm text-muted-foreground">
          Team members can be assigned Creative Requests and Tasks. No login or invite is sent.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Name (e.g. Jordan Lee)"
            aria-label="Name"
            value={newMemberName}
            onChange={(e) => setNewMemberName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && newMemberName.trim() && addMember.mutate()}
            className="flex-1"
          />
          <Input
            placeholder="Position (e.g. Video Editor)"
            aria-label="Position"
            value={newMemberPosition}
            onChange={(e) => setNewMemberPosition(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && newMemberName.trim() && addMember.mutate()}
            className="flex-1"
          />
          <Button
            size="sm"
            onClick={() => addMember.mutate()}
            disabled={!newMemberName.trim() || addMember.isPending}
            className="shrink-0"
          >
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </div>

        {teamMembers.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No team members yet. Add someone to start assigning work.
          </p>
        ) : (
          <div className="space-y-2">
            {teamMembers.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {m.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{m.name}</p>
                    {m.position && <p className="truncate text-xs text-muted-foreground">{m.position}</p>}
                  </div>
                </div>
                <button
                  onClick={() => removeMember.mutate(m.id)}
                  className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Remove ${m.name}`}
                  title="Remove team member"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
