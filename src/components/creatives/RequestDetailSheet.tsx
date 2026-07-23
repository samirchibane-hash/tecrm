import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Image as ImageIcon, Film, Check, Loader2,
  Send, MessageSquare, FolderOpen, FolderPlus, ExternalLink, Trash2,
} from "lucide-react";
import { StageSelect } from "@/components/StageSelect";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AssigneeSelect } from "@/components/AssigneeSelect";
import {
  CreativeRequest, RequestComment,
  STATUS_STEPS, STATUS_LABEL, STATUS_BADGE, STATUS_DOT,
  type RequestStatus,
} from "./types";

interface Props {
  request: CreativeRequest | null;
  onClose: () => void;
  onRequestChange?: (updated: CreativeRequest) => void;
}

export function RequestDetailSheet({ request, onClose, onRequestChange }: Props) {
  const queryClient = useQueryClient();
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [assignedTo, setAssignedTo] = useState("");
  const [assignSaving, setAssignSaving] = useState(false);
  const [driveLink, setDriveLink] = useState("");
  const [driveSaving, setDriveSaving] = useState(false);
  const [commentAuthor, setCommentAuthor] = useState(() => localStorage.getItem("te_username") ?? "");
  const [commentBody, setCommentBody] = useState("");
  const [commentSending, setCommentSending] = useState(false);

  // Sync local inputs when request changes
  useEffect(() => {
    if (request) {
      setAssignedTo(request.assigned_to ?? "");
      setDriveLink(request.gdrive_folder_url ?? "");
    }
  }, [request?.id]);

  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: ["creative-request-comments", request?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creative_request_comments")
        .select("*")
        .eq("request_id", request!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as RequestComment[];
    },
    enabled: !!request,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("creative_requests")
        .update({ status, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { id, status }) => {
      queryClient.invalidateQueries({ queryKey: ["creative-requests"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-creative-requests"] });
      onRequestChange?.({ ...request!, status });
      toast.success(`Status updated to ${STATUS_LABEL[status as RequestStatus]}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveDriveLink = useMutation({
    mutationFn: async ({ id, url }: { id: string; url: string }) => {
      setDriveSaving(true);
      const { error } = await supabase.from("creative_requests")
        .update({ gdrive_folder_url: url || null, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { id, url }) => {
      queryClient.invalidateQueries({ queryKey: ["creative-requests"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-creative-requests"] });
      onRequestChange?.({ ...request!, gdrive_folder_url: url || null });
      setDriveSaving(false);
      toast.success("Drive link saved");
    },
    onError: (err: Error) => { setDriveSaving(false); toast.error(err.message); },
  });

  const createDriveFolder = useMutation({
    mutationFn: async () => {
      const folderName = `${request!.template_name} – ${request!.ad_angle}`;
      const { data, error } = await supabase.functions.invoke("create-creative-folder", {
        body: {
          request_id: request!.id,
          account_name: request!.account_name,
          ad_type: request!.ad_type,
          folder_name: folderName,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.folder_url as string;
    },
    onSuccess: (folderUrl) => {
      setDriveLink(folderUrl);
      queryClient.invalidateQueries({ queryKey: ["creative-requests"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-creative-requests"] });
      onRequestChange?.({ ...request!, gdrive_folder_url: folderUrl });
      toast.success("Drive folder created");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveAssignee = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      setAssignSaving(true);
      const { error } = await supabase.from("creative_requests")
        .update({ assigned_to: name.trim() || null, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { id, name }) => {
      queryClient.invalidateQueries({ queryKey: ["creative-requests"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-creative-requests"] });
      onRequestChange?.({ ...request!, assigned_to: name.trim() || null });
      setAssignSaving(false);
      toast.success("Assignee updated");
    },
    onError: (err: Error) => { setAssignSaving(false); toast.error(err.message); },
  });

  const sendComment = useMutation({
    mutationFn: async () => {
      if (!request || !commentBody.trim() || !commentAuthor.trim()) return;
      setCommentSending(true);
      const { error } = await supabase.from("creative_request_comments").insert({
        request_id: request.id,
        author: commentAuthor.trim(),
        body: commentBody.trim(),
      });
      if (error) throw error;
      if (commentAuthor.trim()) localStorage.setItem("te_username", commentAuthor.trim());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creative-request-comments", request?.id] });
      setCommentBody("");
      setCommentSending(false);
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    },
    onError: (err: Error) => { setCommentSending(false); toast.error(err.message); },
  });

  const deleteRequest = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("creative_requests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creative-requests"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-creative-requests"] });
      toast.success("Request deleted");
      setConfirmDelete(false);
      onClose();
    },
    onError: (err: Error) => { setConfirmDelete(false); toast.error(err.message); },
  });

  return (
    <>
    <Sheet open={!!request} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col overflow-hidden">
        {request && (
          <>
            {/* Header */}
            <div className="relative px-6 pt-6 pb-4 border-b border-border shrink-0">
              <div className="flex items-start gap-3 pr-10">
                <div className={cn("rounded-lg p-2 mt-0.5 shrink-0", request.ad_type === "image_ads" ? "bg-sky-50" : "bg-violet-50")}>
                  {request.ad_type === "image_ads"
                    ? <ImageIcon className="h-4 w-4 text-sky-600" />
                    : <Film className="h-4 w-4 text-violet-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-semibold text-foreground">{request.is_template ? request.template_name : request.account_name}</h2>
                    {request.is_template && (
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-indigo-100 text-indigo-800">
                        Template production
                      </span>
                    )}
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", request.ad_type === "image_ads" ? "bg-sky-100 text-sky-800" : "bg-violet-100 text-violet-800")}>
                      {request.ad_type === "image_ads" ? "Image Ads" : "Video Ads"}
                    </span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS_BADGE[request.status as RequestStatus])}>
                      {STATUS_LABEL[request.status as RequestStatus]}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {[request.is_template ? "Master template" : request.template_name, request.ad_angle, request.offer_type]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </div>

              <Button
                variant="ghost" size="icon"
                className="absolute top-4 right-12 h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>

              {/* Status progress */}
              <div className="flex items-center gap-0 mt-4">
                {STATUS_STEPS.map((step, i) => {
                  const stepIdx = STATUS_STEPS.indexOf(request.status as RequestStatus);
                  const isActive = step === request.status;
                  const isPast = i < stepIdx;
                  return (
                    <div key={step} className="flex items-center flex-1 min-w-0">
                      <div className="flex flex-col items-center gap-1 min-w-0">
                        <div className={cn("h-2 w-2 rounded-full shrink-0 transition-colors",
                          isActive ? STATUS_DOT[step] : isPast ? "bg-emerald-400" : "bg-muted-foreground/20")} />
                        <span className={cn("text-[10px] leading-none truncate max-w-[60px] text-center",
                          isActive ? "font-semibold text-foreground" : isPast ? "text-muted-foreground" : "text-muted-foreground/40")}>
                          {STATUS_LABEL[step]}
                        </span>
                      </div>
                      {i < STATUS_STEPS.length - 1 && (
                        <div className={cn("h-px flex-1 mx-1 transition-colors",
                          isPast || isActive ? "bg-muted-foreground/30" : "bg-muted-foreground/10")} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

              {/* Brief */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Brief</h3>
                <div className="rounded-xl border border-border bg-muted/30 divide-y divide-border">
                  {([
                    ["Template", request.template_name],
                    ["Ad Angle", request.ad_angle],
                    ["Offer Type", request.offer_type],
                    ["Requested", format(new Date(request.created_at), "MMM d, yyyy · h:mm a")],
                  ] as [string, string][]).map(([label, value]) => (
                    <div key={label} className="flex items-center gap-4 px-4 py-2.5">
                      <span className="text-xs text-muted-foreground w-24 shrink-0">{label}</span>
                      <span className="text-xs font-medium text-foreground">{value}</span>
                    </div>
                  ))}
                  {request.notes && (
                    <div className="px-4 py-2.5">
                      <span className="text-xs text-muted-foreground block mb-1">Notes</span>
                      <p className="text-xs text-foreground leading-relaxed">{request.notes}</p>
                    </div>
                  )}
                </div>
              </section>

              {/* Assigned to */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Assigned To</h3>
                <div className="flex items-center gap-2">
                  <AssigneeSelect
                    className="h-9 w-full"
                    placeholder="Unassigned"
                    value={assignedTo}
                    onChange={(name) => {
                      setAssignedTo(name);
                      saveAssignee.mutate({ id: request.id, name });
                    }}
                  />
                  {assignSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
                </div>
              </section>

              {/* Drive folder */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Drive Folder</h3>

                {/* Existing folder link */}
                {request.gdrive_folder_url ? (
                  <a href={request.gdrive_folder_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 mb-3 text-xs font-medium text-emerald-800 hover:bg-emerald-100 transition-colors group">
                    <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate flex-1">Open in Drive</span>
                    <ExternalLink className="h-3 w-3 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" />
                  </a>
                ) : (
                  /* Create button — shown when no folder exists yet */
                  <button
                    type="button"
                    onClick={() => createDriveFolder.mutate()}
                    disabled={createDriveFolder.isPending}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3.5 mb-3 transition-all text-left",
                      "border-border hover:border-primary/40 hover:bg-primary/5",
                      "disabled:opacity-60 disabled:pointer-events-none",
                      request.ad_type === "image_ads"
                        ? "hover:border-sky-300 hover:bg-sky-50/60"
                        : "hover:border-violet-300 hover:bg-violet-50/60"
                    )}
                  >
                    <div className={cn(
                      "rounded-lg p-2 shrink-0 transition-colors",
                      createDriveFolder.isPending ? "bg-muted" :
                        request.ad_type === "image_ads" ? "bg-sky-100" : "bg-violet-100"
                    )}>
                      {createDriveFolder.isPending
                        ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        : <FolderPlus className={cn("h-4 w-4", request.ad_type === "image_ads" ? "text-sky-600" : "text-violet-600")} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground">
                        {createDriveFolder.isPending ? "Creating folder…" : "Create Drive Folder"}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {request.ad_type === "image_ads" ? "Image Ads" : "Video Ads"} › {request.template_name}
                      </p>
                    </div>
                  </button>
                )}

                {/* Manual paste — always available as override */}
                <div className="flex gap-2">
                  <Input
                    className="text-sm h-9 text-xs"
                    placeholder={request.gdrive_folder_url ? "Replace Drive link…" : "Or paste Drive link manually…"}
                    value={driveLink}
                    onChange={(e) => setDriveLink(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveDriveLink.mutate({ id: request.id, url: driveLink }); }}
                  />
                  <Button size="sm" variant="outline" className="shrink-0"
                    disabled={driveLink === (request.gdrive_folder_url ?? "") || driveSaving}
                    onClick={() => saveDriveLink.mutate({ id: request.id, url: driveLink })}>
                    {driveSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </section>

              {/* Stage */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Stage</h3>
                <div className="flex items-center gap-2">
                  <StageSelect
                    value={request.status}
                    onChange={(v) => updateStatus.mutate({ id: request.id, status: v })}
                    disabled={updateStatus.isPending}
                  />
                  {updateStatus.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
                </div>
              </section>

              {/* Comments */}
              <section className="pb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" /> Comments
                </h3>

                {commentsLoading && (
                  <div className="space-y-2">
                    {[1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
                  </div>
                )}

                {!commentsLoading && comments.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No comments yet. Start the conversation.</p>
                )}

                {!commentsLoading && comments.length > 0 && (
                  <div className="space-y-3">
                    {comments.map((c) => (
                      <div key={c.id} className="rounded-xl border border-border bg-muted/30 px-4 py-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-semibold text-foreground">{c.author}</span>
                          <span className="text-[10px] text-muted-foreground">{format(new Date(c.created_at), "MMM d, h:mm a")}</span>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{c.body}</p>
                      </div>
                    ))}
                    <div ref={commentsEndRef} />
                  </div>
                )}

                <div className="mt-4 space-y-2">
                  <Input className="text-xs h-8" placeholder="Your name"
                    value={commentAuthor} onChange={(e) => setCommentAuthor(e.target.value)} />
                  <Textarea className="text-sm resize-none" rows={3} placeholder="Write a comment…"
                    value={commentBody} onChange={(e) => setCommentBody(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendComment.mutate(); }}
                  />
                  <Button size="sm" className="gap-1.5 w-full"
                    disabled={!commentBody.trim() || !commentAuthor.trim() || commentSending}
                    onClick={() => sendComment.mutate()}>
                    {commentSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    {commentSending ? "Sending…" : "Send"}
                  </Button>
                </div>
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>

    <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this creative request?</AlertDialogTitle>
          <AlertDialogDescription>This will permanently delete the brief and all its comments.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => request && deleteRequest.mutate(request.id)}
          >
            {deleteRequest.isPending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
