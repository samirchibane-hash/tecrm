import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, FolderOpen, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function useDriveFolder(accountId: string, accountName: string, current: string | null) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(current ?? "");
  const [saving, setSaving] = useState(false);
  useEffect(() => setValue(current ?? ""), [current]);

  async function save(onSuccess?: () => void) {
    if (!accountId) return;
    setSaving(true);
    const { error } = await supabase.from("accounts").update({ gdrive_folder_url: value || null }).eq("id", accountId);
    if (error) toast.error("Failed to save Drive folder");
    else {
      queryClient.invalidateQueries({ queryKey: ["account", accountName] });
      toast.success("Drive folder saved");
      onSuccess?.();
    }
    setSaving(false);
  }
  return { value, setValue, saving, save };
}

/** Header shortcut: open the client's Drive folder, or paste one in. */
export function DriveHeaderButton({ accountId, accountName, url }: { accountId: string; accountName: string; url: string | null }) {
  const [open, setOpen] = useState(false);
  const drive = useDriveFolder(accountId, accountName, url);

  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 rounded-md border border-border/60 bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
      >
        <FolderOpen className="h-3.5 w-3.5" />
        Drive
      </a>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 rounded-md border border-dashed border-border/60 bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border hover:bg-muted/40 hover:text-foreground">
          <Plus className="h-3 w-3" />
          Add Drive
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-80 p-4">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Google Drive folder</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Paste the client's shared folder URL</p>
          </div>
          <Input
            autoFocus
            value={drive.value}
            onChange={(e) => drive.setValue(e.target.value)}
            placeholder="https://drive.google.com/drive/folders/…"
            aria-label="Drive folder URL"
            className="h-8 text-xs"
            onKeyDown={(e) => { if (e.key === "Enter" && drive.value.trim() && !drive.saving) drive.save(() => setOpen(false)); }}
          />
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setOpen(false); drive.setValue(""); }}>Cancel</Button>
            <Button size="sm" className="h-7 text-xs" disabled={!drive.value.trim() || drive.saving} onClick={() => drive.save(() => setOpen(false))}>
              {drive.saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function DriveFolderCard({ accountId, accountName, url }: { accountId: string; accountName: string; url: string | null }) {
  const drive = useDriveFolder(accountId, accountName, url);
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          Google Drive
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            Open Client Folder
          </a>
        )}
        <div className="flex items-center gap-2">
          <Input value={drive.value} onChange={(e) => drive.setValue(e.target.value)} placeholder="Paste Google Drive folder URL…" aria-label="Drive folder URL" className="h-8 text-xs" />
          <Button size="sm" className="h-8 shrink-0" disabled={drive.saving || drive.value === (url ?? "")} onClick={() => drive.save()}>
            {drive.saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
