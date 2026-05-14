import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Plus,
  X,
  Pencil,
  MoreVertical,
  Trash2,
  Image as ImageIcon,
  ExternalLink,
  Search,
  Info,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Creative = {
  id: string;
  account_name: string;
  batch_name: string | null;
  file_name: string;
  file_url: string;
  file_type: string;
  launch_date: string | null;
  created_at: string;
};

const CLIENT_COLORS = [
  "bg-blue-100 text-blue-800 hover:bg-blue-200",
  "bg-emerald-100 text-emerald-800 hover:bg-emerald-200",
  "bg-amber-100 text-amber-800 hover:bg-amber-200",
  "bg-purple-100 text-purple-800 hover:bg-purple-200",
  "bg-rose-100 text-rose-800 hover:bg-rose-200",
  "bg-cyan-100 text-cyan-800 hover:bg-cyan-200",
  "bg-orange-100 text-orange-800 hover:bg-orange-200",
  "bg-indigo-100 text-indigo-800 hover:bg-indigo-200",
];

const Creatives = () => {
  const queryClient = useQueryClient();
  const [filterAccount, setFilterAccount] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Add production dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addTemplateName, setAddTemplateName] = useState("");
  const [addClient, setAddClient] = useState("");
  const [addGdriveUrl, setAddGdriveUrl] = useState("");
  const [addPreviewFile, setAddPreviewFile] = useState<File | null>(null);
  const [addPreviewPreview, setAddPreviewPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Rename template dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editTemplateName, setEditTemplateName] = useState("");
  const [editNewName, setEditNewName] = useState("");

  // Edit client production dialog
  const [editProdOpen, setEditProdOpen] = useState(false);
  const [editProdOriginalTemplate, setEditProdOriginalTemplate] = useState("");
  const [editProdTemplateName, setEditProdTemplateName] = useState("");
  const [editProdClient, setEditProdClient] = useState("");
  const [editProdGdriveUrl, setEditProdGdriveUrl] = useState("");
  const [editProdSaving, setEditProdSaving] = useState(false);

  // Delete template
  const [deleteTemplateName, setDeleteTemplateName] = useState<string | null>(null);

  // Lightbox
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("*").order("account_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: creatives = [], isLoading } = useQuery({
    queryKey: ["creatives"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creatives")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Creative[];
    },
  });

  // Stable color assignment per account name
  const accountColors = useMemo(() => {
    const map: Record<string, string> = {};
    const names = [...new Set(creatives.map((c) => c.account_name))].sort();
    names.forEach((name, i) => {
      map[name] = CLIENT_COLORS[i % CLIENT_COLORS.length];
    });
    return map;
  }, [creatives]);

  // Group by template (batch_name), derive preview + client map
  const templateGroups = useMemo(() => {
    const map: Record<string, Creative[]> = {};
    creatives.forEach((c) => {
      const key = c.batch_name || "Uncategorized";
      if (!map[key]) map[key] = [];
      map[key].push(c);
    });

    return Object.entries(map)
      .map(([name, items]) => {
        // First uploaded image across any client = template preview
        const previewImage = items.find((i) => i.file_type !== "link")?.file_url ?? null;

        // One entry per client; link takes priority over null
        const clientMap: Record<string, string | null> = {};
        items.forEach((i) => {
          if (i.file_type === "link") {
            clientMap[i.account_name] = i.file_url;
          } else if (!(i.account_name in clientMap)) {
            clientMap[i.account_name] = null;
          }
        });

        return { name, previewImage, clients: clientMap, items };
      })
      .filter(({ name, clients }) => {
        if (filterAccount !== "all" && !(filterAccount in clients)) return false;
        if (search && !name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [creatives, filterAccount, search]);

  const existingTemplates = useMemo(() => {
    return [...new Set(creatives.map((c) => c.batch_name || "Uncategorized"))].sort();
  }, [creatives]);

  // Add a client production (GDrive link + optional preview image)
  const saveProduction = useMutation({
    mutationFn: async () => {
      if (!addTemplateName.trim() || !addClient || !addGdriveUrl.trim()) return;
      setSaving(true);

      if (addPreviewFile) {
        const ext = addPreviewFile.name.split(".").pop();
        const path = `${addClient}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("creatives").upload(path, addPreviewFile);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from("creatives").getPublicUrl(path);
        const { error: imgErr } = await supabase.from("creatives").insert({
          account_name: addClient,
          batch_name: addTemplateName.trim(),
          file_name: addPreviewFile.name,
          file_url: urlData.publicUrl,
          file_type: "image",
          launch_date: null,
        });
        if (imgErr) throw imgErr;
      }

      const { error } = await supabase.from("creatives").insert({
        account_name: addClient,
        batch_name: addTemplateName.trim(),
        file_name: addGdriveUrl.trim(),
        file_url: addGdriveUrl.trim(),
        file_type: "link",
        launch_date: null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creatives"] });
      resetAddForm();
      toast.success("Production added");
    },
    onError: (err: Error) => {
      setSaving(false);
      toast.error(`Failed: ${err.message}`);
    },
  });

  // Rename template (updates batch_name on all items)
  const renameTemplate = useMutation({
    mutationFn: async ({ oldName, newName }: { oldName: string; newName: string }) => {
      const items = creatives.filter((c) => (c.batch_name || "Uncategorized") === oldName);
      for (const item of items) {
        const { error } = await supabase.from("creatives").update({ batch_name: newName }).eq("id", item.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creatives"] });
      setEditOpen(false);
      toast.success("Template renamed");
    },
    onError: (err: Error) => toast.error(`Failed: ${err.message}`),
  });

  // Delete entire template
  const deleteTemplate = useMutation({
    mutationFn: async (templateName: string) => {
      const items = creatives.filter((c) => (c.batch_name || "Uncategorized") === templateName);
      for (const item of items) {
        if (item.file_type !== "link" && item.file_url.includes("creatives/")) {
          const path = item.file_url.split("/storage/v1/object/public/creatives/")[1];
          if (path) await supabase.storage.from("creatives").remove([path]);
        }
        await supabase.from("creatives").delete().eq("id", item.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creatives"] });
      setDeleteTemplateName(null);
      toast.success("Template deleted");
    },
    onError: (err: Error) => toast.error(`Failed: ${err.message}`),
  });

  // Update a client production's template name and/or GDrive link
  const updateClientProduction = useMutation({
    mutationFn: async ({
      originalTemplate,
      originalClient,
      newTemplate,
      newGdriveUrl,
    }: {
      originalTemplate: string;
      originalClient: string;
      newTemplate: string;
      newGdriveUrl: string;
    }) => {
      setEditProdSaving(true);
      const items = creatives.filter(
        (c) => (c.batch_name || "Uncategorized") === originalTemplate && c.account_name === originalClient
      );
      for (const item of items) {
        const updates: Record<string, string | null> = {};
        if (newTemplate !== originalTemplate) updates.batch_name = newTemplate;
        if (item.file_type === "link" && newGdriveUrl !== item.file_url) {
          updates.file_url = newGdriveUrl;
          updates.file_name = newGdriveUrl;
        }
        if (Object.keys(updates).length > 0) {
          const { error } = await supabase.from("creatives").update(updates).eq("id", item.id);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creatives"] });
      setEditProdOpen(false);
      setEditProdSaving(false);
      toast.success("Production updated");
    },
    onError: (err: Error) => {
      setEditProdSaving(false);
      toast.error(`Failed: ${err.message}`);
    },
  });

  const resetAddForm = () => {
    setAddOpen(false);
    setAddTemplateName("");
    setAddClient("");
    setAddGdriveUrl("");
    setAddPreviewFile(null);
    setAddPreviewPreview(null);
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Creatives</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Template library — see which clients each template was produced for
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-9 w-[180px] text-xs"
                placeholder="Search templates…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={filterAccount} onValueChange={setFilterAccount}>
              <SelectTrigger className="w-[160px] h-9 text-xs">
                <SelectValue placeholder="All Clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.account_name}>
                    {a.account_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Add Production
            </Button>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/3] rounded-xl" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && templateGroups.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-lg font-medium text-foreground">No templates yet</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Add client productions to build your template library.
            </p>
            <Button onClick={() => setAddOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> Add Production
            </Button>
          </div>
        )}

        {/* Template grid */}
        {!isLoading && templateGroups.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {templateGroups.map(({ name, previewImage, clients }) => (
              <div
                key={name}
                className="rounded-xl border border-border bg-card overflow-hidden flex flex-col shadow-sm"
              >
                {/* Preview */}
                <div
                  className={cn(
                    "aspect-video bg-muted flex items-center justify-center",
                    previewImage && "cursor-pointer"
                  )}
                  onClick={() => previewImage && setLightboxUrl(previewImage)}
                >
                  {previewImage ? (
                    <img
                      src={previewImage}
                      alt={name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <ImageIcon className="h-10 w-10 text-muted-foreground/25" />
                  )}
                </div>

                {/* Card body */}
                <div className="p-4 flex flex-col gap-3 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm leading-tight text-foreground">{name}</h3>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 -mt-0.5">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditTemplateName(name);
                            setEditNewName(name);
                            setEditOpen(true);
                          }}
                        >
                          <Pencil className="mr-2 h-3.5 w-3.5" /> Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setAddTemplateName(name);
                            setAddOpen(true);
                          }}
                        >
                          <Plus className="mr-2 h-3.5 w-3.5" /> Add client
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteTemplateName(name)}
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete template
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Client pills */}
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(clients).map(([clientName, gdriveUrl]) => {
                      const colorClass = accountColors[clientName] ?? CLIENT_COLORS[0];
                      return (
                        <span
                          key={clientName}
                          className={cn(
                            "group/pill inline-flex items-center gap-0 rounded-full text-[11px] font-semibold transition-colors",
                            colorClass
                          )}
                        >
                          {gdriveUrl ? (
                            <a
                              href={gdriveUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="pl-2.5 pr-1 py-0.5 flex items-center gap-1"
                            >
                              {clientName}
                              <ExternalLink className="h-2.5 w-2.5 opacity-50" />
                            </a>
                          ) : (
                            <span className="pl-2.5 pr-1 py-0.5">{clientName}</span>
                          )}
                          <button
                            className="pr-1.5 py-0.5 opacity-0 group-hover/pill:opacity-60 hover:!opacity-100 transition-opacity"
                            title={`Edit ${clientName} production`}
                            onClick={() => {
                              const link = clients[clientName] ?? "";
                              setEditProdOriginalTemplate(name);
                              setEditProdTemplateName(name);
                              setEditProdClient(clientName);
                              setEditProdGdriveUrl(link);
                              setEditProdOpen(true);
                            }}
                          >
                            <Info className="h-2.5 w-2.5" />
                          </button>
                        </span>
                      );
                    })}
                  </div>

                  <p className="text-[11px] text-muted-foreground mt-auto">
                    {Object.keys(clients).length} client{Object.keys(clients).length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Production Dialog */}
        <Dialog open={addOpen} onOpenChange={(open) => { if (!open) resetAddForm(); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Client Production</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Template</label>
                <Input
                  list="template-list"
                  placeholder="Template name (e.g. Showers, Skin & Hair)"
                  value={addTemplateName}
                  onChange={(e) => setAddTemplateName(e.target.value)}
                />
                <datalist id="template-list">
                  {existingTemplates.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Client</label>
                <Select value={addClient} onValueChange={setAddClient}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.account_name}>
                        {a.account_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Google Drive Link</label>
                <Input
                  placeholder="https://drive.google.com/…"
                  value={addGdriveUrl}
                  onChange={(e) => setAddGdriveUrl(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Preview Image <span className="text-muted-foreground/60">(optional)</span>
                </label>
                <div className="relative rounded-xl border-2 border-dashed border-border p-4 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setAddPreviewFile(file);
                      setAddPreviewPreview(URL.createObjectURL(file));
                    }}
                  />
                  {addPreviewPreview ? (
                    <div className="relative inline-block">
                      <img
                        src={addPreviewPreview}
                        alt="Preview"
                        className="max-h-32 rounded-lg mx-auto"
                      />
                      <button
                        className="absolute -top-1 -right-1 bg-background rounded-full border border-border p-0.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAddPreviewFile(null);
                          setAddPreviewPreview(null);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Upload a thumbnail for this template</p>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetAddForm}>
                Cancel
              </Button>
              <Button
                onClick={() => saveProduction.mutate()}
                disabled={!addTemplateName.trim() || !addClient || !addGdriveUrl.trim() || saving}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Client Production Dialog */}
        <Dialog open={editProdOpen} onOpenChange={(open) => { if (!open) { setEditProdOpen(false); setEditProdSaving(false); } }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Edit Production — {editProdClient}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Template</label>
                <Input
                  list="edit-template-list"
                  placeholder="Template name"
                  value={editProdTemplateName}
                  onChange={(e) => setEditProdTemplateName(e.target.value)}
                />
                <datalist id="edit-template-list">
                  {existingTemplates.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Google Drive Link</label>
                <Input
                  placeholder="https://drive.google.com/…"
                  value={editProdGdriveUrl}
                  onChange={(e) => setEditProdGdriveUrl(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditProdOpen(false)}>Cancel</Button>
              <Button
                onClick={() =>
                  updateClientProduction.mutate({
                    originalTemplate: editProdOriginalTemplate,
                    originalClient: editProdClient,
                    newTemplate: editProdTemplateName.trim(),
                    newGdriveUrl: editProdGdriveUrl.trim(),
                  })
                }
                disabled={!editProdTemplateName.trim() || editProdSaving}
              >
                {editProdSaving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Rename Template Dialog */}
        <Dialog open={editOpen} onOpenChange={(open) => { if (!open) setEditOpen(false); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Rename Template</DialogTitle>
            </DialogHeader>
            <Input
              placeholder="Template name"
              value={editNewName}
              onChange={(e) => setEditNewName(e.target.value)}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  renameTemplate.mutate({ oldName: editTemplateName, newName: editNewName.trim() })
                }
                disabled={!editNewName.trim() || editNewName.trim() === editTemplateName}
              >
                Rename
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Lightbox */}
        <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
          <DialogContent className="max-w-4xl p-2">
            {lightboxUrl && (
              <img
                src={lightboxUrl}
                alt="Preview"
                className="max-w-full max-h-[85vh] object-contain mx-auto rounded-lg"
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Template Confirmation */}
        <AlertDialog
          open={!!deleteTemplateName}
          onOpenChange={(open) => { if (!open) setDeleteTemplateName(null); }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete "{deleteTemplateName}"?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this template and all client productions. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteTemplateName && deleteTemplate.mutate(deleteTemplateName)}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default Creatives;
