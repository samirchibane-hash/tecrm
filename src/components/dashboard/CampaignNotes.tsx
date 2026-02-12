import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface CampaignNotesProps {
  accountName: string;
  campaigns: string[];
}

export function CampaignNotes({ accountName, campaigns }: CampaignNotesProps) {
  const queryClient = useQueryClient();
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [content, setContent] = useState("");
  const [showForm, setShowForm] = useState(false);

  const { data: notes = [] } = useQuery({
    queryKey: ["campaign-notes", accountName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_notes")
        .select("*")
        .eq("account_name", accountName)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addNote = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("campaign_notes").insert({
        account_name: accountName,
        campaign_name: selectedCampaign,
        content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-notes", accountName] });
      setContent("");
      setSelectedCampaign("");
      setShowForm(false);
      toast.success("Note added");
    },
    onError: () => toast.error("Failed to add note"),
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaign_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-notes", accountName] });
      toast.success("Note deleted");
    },
  });

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <MessageSquare className="h-4 w-4" /> Notes
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-1 h-4 w-4" /> Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="space-y-3 rounded-xl border border-border p-4">
            <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
              <SelectTrigger><SelectValue placeholder="Select campaign" /></SelectTrigger>
              <SelectContent>
                {campaigns.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea placeholder="Write a note..." value={content} onChange={(e) => setContent(e.target.value)} rows={3} />
            <Button
              size="sm"
              onClick={() => addNote.mutate()}
              disabled={!selectedCampaign || !content.trim() || addNote.isPending}
            >
              Save Note
            </Button>
          </div>
        )}

        {notes.length === 0 && !showForm && (
          <p className="text-sm text-muted-foreground text-center py-6">No notes yet</p>
        )}

        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {notes.map((note) => (
            <div key={note.id} className="group rounded-xl border border-border/60 p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{note.campaign_name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {new Date(note.created_at).toLocaleDateString()}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => deleteNote.mutate(note.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-foreground">{note.content}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
