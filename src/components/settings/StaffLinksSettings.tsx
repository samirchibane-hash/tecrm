import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { ClipboardList, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export function StaffLinksSettings() {
  return (
    <div className="space-y-6">
      <CreativeBriefsLinkCard />
    </div>
  );
}

function CreativeBriefsLinkCard() {
  const queryClient = useQueryClient();
  const [confirmRotate, setConfirmRotate] = useState(false);

  const { data: link, isLoading, error } = useQuery({
    queryKey: ["staff-share-link", "creative_briefs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_share_links")
        .select("token, created_at, rotated_at")
        .eq("scope", "creative_briefs")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const url = link ? `${window.location.origin}/briefs/${link.token}` : "";

  const rotate = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("staff_share_links")
        .update({ token: crypto.randomUUID(), rotated_at: new Date().toISOString() })
        .eq("scope", "creative_briefs");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-share-link", "creative_briefs"] });
      setConfirmRotate(false);
      toast.success("New link created — the old one no longer works");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy — select the link and copy it manually");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ClipboardList className="h-4 w-4" /> Creative Briefs
        </CardTitle>
        <CardDescription>
          A read-only list of every creative brief, with the client's Drive folder and the template link on each one.
          Anyone with this link can view it without logging in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <Skeleton className="h-9 w-full" />}

        {error && <p className="text-sm text-danger">Couldn't load the link: {(error as Error).message}</p>}

        {!isLoading && !error && !link && (
          <p className="text-sm text-muted-foreground">
            No briefs link exists yet. Apply the <code>staff_brief_share_link</code> migration to create one.
          </p>
        )}

        {link && (
          <>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input readOnly value={url} aria-label="Creative briefs staff link" onFocus={(e) => e.target.select()} className="font-mono text-xs" />
              <div className="flex gap-2">
                <Button variant="outline" className="gap-1.5" onClick={copy}><Copy className="h-4 w-4" /> Copy</Button>
                <Button variant="outline" size="icon" asChild>
                  <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Open briefs link in a new tab"><ExternalLink className="h-4 w-4" /></a>
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {link.rotated_at
                  ? `Replaced ${formatDistanceToNowStrict(new Date(link.rotated_at), { addSuffix: true })}`
                  : `Created ${formatDistanceToNowStrict(new Date(link.created_at), { addSuffix: true })}`}
              </p>
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => setConfirmRotate(true)}>
                <RefreshCw className="h-3.5 w-3.5" /> Replace link
              </Button>
            </div>
          </>
        )}
      </CardContent>

      <AlertDialog open={confirmRotate} onOpenChange={setConfirmRotate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace the briefs link?</AlertDialogTitle>
            <AlertDialogDescription>
              The current link stops working immediately. Use this when someone who had it shouldn't anymore, then share the new link with current staff.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); rotate.mutate(); }} disabled={rotate.isPending}>
              {rotate.isPending ? "Replacing…" : "Replace link"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
