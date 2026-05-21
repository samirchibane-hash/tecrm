import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Plus,
  X,
  MoreVertical,
  Trash2,
  Image as ImageIcon,
  ExternalLink,
  Search,
  Info,
  Camera,
  Upload,
  Film,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Loader2,
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

// ── Types ────────────────────────────────────────────────────────────────────

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

type CreativeBatch = {
  id: string;
  account_name: string;
  ad_type: string;
  template_name: string;
  ad_angle: string;
  offer_type: string;
  notes: string | null;
  gdrive_folder_id: string | null;
  gdrive_folder_url: string | null;
  file_count: number;
  created_at: string;
  uploads?: CreativeUpload[];
};

type CreativeUpload = {
  id: string;
  batch_id: string;
  file_name: string;
  storage_path: string | null;
  storage_url: string | null;
  gdrive_file_id: string | null;
  gdrive_view_url: string | null;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
};

type QueuedFile = {
  id: string;
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
  storageUrl?: string;
  storagePath?: string;
};

// ── Constants ────────────────────────────────────────────────────────────────

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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isVideoMime(mime: string | null): boolean {
  return !!mime && mime.startsWith("video/");
}

function isImageMime(mime: string | null): boolean {
  return !!mime && mime.startsWith("image/");
}

// ── Main component ───────────────────────────────────────────────────────────

const Creatives = () => {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<"library" | "outputs">(
    searchParams.get("tab") === "outputs" ? "outputs" : "library"
  );

  // ── Template Library state ──
  const [filterAccount, setFilterAccount] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addTemplateName, setAddTemplateName] = useState("");
  const [addClient, setAddClient] = useState("");
  const [addGdriveUrl, setAddGdriveUrl] = useState("");
  const [addPreviewFile, setAddPreviewFile] = useState<File | null>(null);
  const [addPreviewPreview, setAddPreviewPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsOriginalName, setSettingsOriginalName] = useState("");
  const [settingsName, setSettingsName] = useState("");
  const [settingsType, setSettingsType] = useState<"image" | "video" | null>(null);
  const [settingsLink, setSettingsLink] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [editProdOpen, setEditProdOpen] = useState(false);
  const [editProdOriginalTemplate, setEditProdOriginalTemplate] = useState("");
  const [editProdTemplateName, setEditProdTemplateName] = useState("");
  const [editProdClient, setEditProdClient] = useState("");
  const [editProdGdriveUrl, setEditProdGdriveUrl] = useState("");
  const [editProdSaving, setEditProdSaving] = useState(false);
  const [deleteTemplateName, setDeleteTemplateName] = useState<string | null>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const [thumbnailTargetTemplate, setThumbnailTargetTemplate] = useState<string | null>(null);
  const [thumbnailUploading, setThumbnailUploading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // ── Ad Outputs state ──
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadClient, setUploadClient] = useState("");
  const [uploadAdType, setUploadAdType] = useState<"image_ads" | "video_ads">("image_ads");
  const [uploadTemplate, setUploadTemplate] = useState("");
  const [uploadAngle, setUploadAngle] = useState("");
  const [uploadOffer, setUploadOffer] = useState("");
  const [uploadNotes, setUploadNotes] = useState("");
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [outputsFilterClient, setOutputsFilterClient] = useState("all");
  const [outputsFilterType, setOutputsFilterType] = useState("all");
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [deleteBatchId, setDeleteBatchId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Open upload dialog immediately if deep-linked with ?upload=1
  useEffect(() => {
    if (searchParams.get("upload") === "1") {
      setActiveTab("outputs");
      setUploadOpen(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("*").order("account_name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch clients to get their gdrive_folder_url
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-gdrive"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, account_id, business_name, full_name, gdrive_folder_url");
      if (error) throw error;
      return data;
    },
  });

  const { data: creatives = [], isLoading: creativesLoading } = useQuery({
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

  const { data: batches = [], isLoading: batchesLoading } = useQuery({
    queryKey: ["creative-batches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creative_batches")
        .select(`*, uploads:creative_uploads(*)`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CreativeBatch[];
    },
  });

  // ── Derived data ─────────────────────────────────────────────────────────

  // Map account_name → gdrive_folder_url using the clients table
  const accountDriveMap = useMemo(() => {
    const map: Record<string, string | null> = {};
    accounts.forEach((a) => {
      const client = clients.find((c) => c.account_id === a.id);
      map[a.account_name] = client?.gdrive_folder_url ?? null;
    });
    return map;
  }, [accounts, clients]);

  const accountColors = useMemo(() => {
    const map: Record<string, string> = {};
    const names = [...new Set(creatives.map((c) => c.account_name))].sort();
    names.forEach((name, i) => { map[name] = CLIENT_COLORS[i % CLIENT_COLORS.length]; });
    return map;
  }, [creatives]);

  const templateGroups = useMemo(() => {
    const map: Record<string, Creative[]> = {};
    creatives.forEach((c) => {
      const key = c.batch_name || "Uncategorized";
      if (!map[key]) map[key] = [];
      map[key].push(c);
    });

    return Object.entries(map)
      .map(([name, items]) => {
        const previewImage = items.find((i) => i.file_type === "image")?.file_url ?? null;
        const typeMeta = items.find((i) => i.file_type === "template_type");
        const templateType: "image" | "video" | null =
          typeMeta && (typeMeta.file_name === "image" || typeMeta.file_name === "video")
            ? typeMeta.file_name : null;
        const templateLink: string = typeMeta?.file_url ?? "";
        const clientMap: Record<string, string | null> = {};
        items.forEach((i) => {
          if (i.file_type === "template_type") return;
          if (i.file_type === "link") clientMap[i.account_name] = i.file_url;
          else if (!(i.account_name in clientMap)) clientMap[i.account_name] = null;
        });
        return { name, previewImage, templateType, templateLink, typeMeta, clients: clientMap, items };
      })
      .filter(({ name, templateType, clients: c }) => {
        if (filterAccount !== "all" && !(filterAccount in c)) return false;
        if (filterType !== "all" && templateType !== filterType) return false;
        if (search && !name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [creatives, filterAccount, filterType, search]);

  const existingTemplates = useMemo(() =>
    [...new Set(creatives.map((c) => c.batch_name || "Uncategorized"))].sort(),
    [creatives]
  );

  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      if (outputsFilterClient !== "all" && b.account_name !== outputsFilterClient) return false;
      if (outputsFilterType !== "all" && b.ad_type !== outputsFilterType) return false;
      return true;
    });
  }, [batches, outputsFilterClient, outputsFilterType]);

  // ── Template Library mutations ────────────────────────────────────────────

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
          account_name: addClient, batch_name: addTemplateName.trim(),
          file_name: addPreviewFile.name, file_url: urlData.publicUrl, file_type: "image", launch_date: null,
        });
        if (imgErr) throw imgErr;
      }
      const { error } = await supabase.from("creatives").insert({
        account_name: addClient, batch_name: addTemplateName.trim(),
        file_name: addGdriveUrl.trim(), file_url: addGdriveUrl.trim(), file_type: "link", launch_date: null,
      });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["creatives"] }); resetAddForm(); toast.success("Production added"); },
    onError: (err: Error) => { setSaving(false); toast.error(`Failed: ${err.message}`); },
  });

  const saveTemplateSettings = useMutation({
    mutationFn: async ({ originalName, newName, type, link, existingMetaId, accountName }: {
      originalName: string; newName: string; type: "image" | "video" | null;
      link: string; existingMetaId: string | null; accountName: string;
    }) => {
      setSettingsSaving(true);
      if (newName !== originalName) {
        const items = creatives.filter((c) => (c.batch_name || "Uncategorized") === originalName);
        for (const item of items) {
          const { error } = await supabase.from("creatives").update({ batch_name: newName }).eq("id", item.id);
          if (error) throw error;
        }
      }
      if (existingMetaId) {
        const { error } = await supabase.from("creatives").update({ file_name: type ?? "", file_url: link, batch_name: newName }).eq("id", existingMetaId);
        if (error) throw error;
      } else if (type || link) {
        const { error } = await supabase.from("creatives").insert({
          account_name: accountName, batch_name: newName, file_name: type ?? "", file_url: link, file_type: "template_type", launch_date: null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["creatives"] }); setSettingsOpen(false); setSettingsSaving(false); toast.success("Template updated"); },
    onError: (err: Error) => { setSettingsSaving(false); toast.error(`Failed: ${err.message}`); },
  });

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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["creatives"] }); setDeleteTemplateName(null); toast.success("Template deleted"); },
    onError: (err: Error) => toast.error(`Failed: ${err.message}`),
  });

  const updateClientProduction = useMutation({
    mutationFn: async ({ originalTemplate, originalClient, newTemplate, newGdriveUrl }: {
      originalTemplate: string; originalClient: string; newTemplate: string; newGdriveUrl: string;
    }) => {
      setEditProdSaving(true);
      const items = creatives.filter((c) => (c.batch_name || "Uncategorized") === originalTemplate && c.account_name === originalClient);
      for (const item of items) {
        const updates: Record<string, string | null> = {};
        if (newTemplate !== originalTemplate) updates.batch_name = newTemplate;
        if (item.file_type === "link" && newGdriveUrl !== item.file_url) { updates.file_url = newGdriveUrl; updates.file_name = newGdriveUrl; }
        if (Object.keys(updates).length > 0) {
          const { error } = await supabase.from("creatives").update(updates).eq("id", item.id);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["creatives"] }); setEditProdOpen(false); setEditProdSaving(false); toast.success("Production updated"); },
    onError: (err: Error) => { setEditProdSaving(false); toast.error(`Failed: ${err.message}`); },
  });

  const uploadThumbnail = useMutation({
    mutationFn: async ({ templateName, file, accountName }: { templateName: string; file: File; accountName: string }) => {
      setThumbnailUploading(true);
      const ext = file.name.split(".").pop();
      const path = `${accountName}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("creatives").upload(path, file);
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from("creatives").getPublicUrl(path);
      const { error } = await supabase.from("creatives").insert({
        account_name: accountName, batch_name: templateName, file_name: file.name,
        file_url: urlData.publicUrl, file_type: "image", launch_date: null,
      });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["creatives"] }); setThumbnailTargetTemplate(null); setThumbnailUploading(false); toast.success("Thumbnail updated"); },
    onError: (err: Error) => { setThumbnailUploading(false); toast.error(`Upload failed: ${err.message}`); },
  });

  // ── Ad Outputs mutations ──────────────────────────────────────────────────

  const deleteBatch = useMutation({
    mutationFn: async (batchId: string) => {
      const batch = batches.find((b) => b.id === batchId);
      if (batch?.uploads) {
        for (const upload of batch.uploads) {
          if (upload.storage_path) {
            await supabase.storage.from("creative-outputs").remove([upload.storage_path]);
          }
        }
      }
      const { error } = await supabase.from("creative_batches").delete().eq("id", batchId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creative-batches"] });
      setDeleteBatchId(null);
      toast.success("Batch deleted");
    },
    onError: (err: Error) => toast.error(`Failed: ${err.message}`),
  });

  // ── Upload flow ───────────────────────────────────────────────────────────

  const addFilesToQueue = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    const valid = arr.filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
    if (valid.length !== arr.length) toast.warning("Only image and video files are accepted");
    setQueuedFiles((prev) => [
      ...prev,
      ...valid.map((f) => ({
        id: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`,
        file: f,
        status: "pending" as const,
      })),
    ]);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFilesToQueue(e.dataTransfer.files);
  }, [addFilesToQueue]);

  const removeQueuedFile = (id: string) =>
    setQueuedFiles((prev) => prev.filter((f) => f.id !== id));

  const resetUploadForm = () => {
    setUploadOpen(false);
    setUploadClient("");
    setUploadAdType("image_ads");
    setUploadTemplate("");
    setUploadAngle("");
    setUploadOffer("");
    setUploadNotes("");
    setQueuedFiles([]);
    setUploading(false);
  };

  const handleUploadBatch = async () => {
    if (!uploadClient || !uploadTemplate.trim() || !uploadAngle.trim() || !uploadOffer.trim()) return;
    if (queuedFiles.length === 0) { toast.error("Add at least one file"); return; }

    const driveUrl = accountDriveMap[uploadClient];
    if (!driveUrl) {
      toast.error("This client has no Google Drive folder linked. Add one in their client profile first.");
      return;
    }

    setUploading(true);

    // Step 1: upload each file to Supabase Storage
    const uploadedFiles: Array<{
      storage_path: string; storage_url: string; file_name: string; mime_type: string; file_size: number;
    }> = [];

    for (const qf of queuedFiles) {
      setQueuedFiles((prev) =>
        prev.map((f) => f.id === qf.id ? { ...f, status: "uploading" } : f)
      );
      const ext = qf.file.name.split(".").pop();
      const path = `${uploadClient}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: storageErr } = await supabase.storage.from("creative-outputs").upload(path, qf.file);
      if (storageErr) {
        setQueuedFiles((prev) =>
          prev.map((f) => f.id === qf.id ? { ...f, status: "error", error: storageErr.message } : f)
        );
        continue;
      }
      const { data: urlData } = supabase.storage.from("creative-outputs").getPublicUrl(path);
      setQueuedFiles((prev) =>
        prev.map((f) => f.id === qf.id ? { ...f, status: "done", storageUrl: urlData.publicUrl, storagePath: path } : f)
      );
      uploadedFiles.push({
        storage_path: path,
        storage_url: urlData.publicUrl,
        file_name: qf.file.name,
        mime_type: qf.file.type,
        file_size: qf.file.size,
      });
    }

    if (uploadedFiles.length === 0) {
      setUploading(false);
      toast.error("All files failed to upload to storage");
      return;
    }

    // Step 2: call edge function to upload to Drive and create DB records
    const { data, error } = await supabase.functions.invoke("upload-creatives-to-drive", {
      body: {
        account_name: uploadClient,
        ad_type: uploadAdType,
        template_name: uploadTemplate.trim(),
        ad_angle: uploadAngle.trim(),
        offer_type: uploadOffer.trim(),
        notes: uploadNotes.trim() || null,
        gdrive_parent_folder_url: driveUrl,
        files: uploadedFiles,
      },
    });

    setUploading(false);

    if (error || data?.error) {
      toast.error(data?.error ?? "Failed to upload to Drive");
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["creative-batches"] });
    toast.success(`Batch uploaded — ${uploadedFiles.length} file${uploadedFiles.length !== 1 ? "s" : ""} sent to Drive`);
    resetUploadForm();
    setActiveTab("outputs");
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const resetAddForm = () => {
    setAddOpen(false); setAddTemplateName(""); setAddClient(""); setAddGdriveUrl("");
    setAddPreviewFile(null); setAddPreviewPreview(null); setSaving(false);
  };

  const toggleBatch = (id: string) =>
    setExpandedBatches((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const folderName = uploadTemplate && uploadAngle && uploadOffer
    ? `${uploadTemplate} - ${uploadAngle} - ${uploadOffer}`
    : null;

  const canUpload = !!uploadClient && !!uploadTemplate.trim() && !!uploadAngle.trim() && !!uploadOffer.trim() && queuedFiles.length > 0 && !uploading;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">

        {/* Page header */}
        <div className="mb-8 flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Creatives</h1>
            <p className="mt-1 text-sm text-muted-foreground">Template library and ad creative output management</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "library" | "outputs")}>
          <TabsList className="mb-6">
            <TabsTrigger value="library">Template Library</TabsTrigger>
            <TabsTrigger value="outputs">Ad Outputs</TabsTrigger>
          </TabsList>

          {/* ────────────── TAB 1: Template Library ────────────── */}
          <TabsContent value="library">
            {/* Toolbar */}
            <div className="mb-6 flex flex-wrap items-center gap-2 justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input className="pl-8 h-9 w-[180px] text-xs" placeholder="Search templates…" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[130px] h-9 text-xs"><SelectValue placeholder="All Types" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="image">Image</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterAccount} onValueChange={setFilterAccount}>
                  <SelectTrigger className="w-[160px] h-9 text-xs"><SelectValue placeholder="All Clients" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {accounts.map((a) => <SelectItem key={a.id} value={a.account_name}>{a.account_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" /> Add Production
              </Button>
            </div>

            {creativesLoading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-[4/3] rounded-xl" />)}
              </div>
            )}

            {!creativesLoading && templateGroups.length === 0 && (
              <div className="flex flex-col items-center gap-4 py-20 text-center">
                <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
                <p className="text-lg font-medium text-foreground">No templates yet</p>
                <p className="max-w-md text-sm text-muted-foreground">Add client productions to build your template library.</p>
                <Button onClick={() => setAddOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" /> Add Production</Button>
              </div>
            )}

            {!creativesLoading && templateGroups.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {templateGroups.map(({ name, previewImage, templateType, templateLink, typeMeta, clients: c, items }) => (
                  <div key={name} className="rounded-xl border border-border bg-card overflow-hidden flex flex-col shadow-sm">
                    <div className="group/preview relative aspect-video bg-muted flex items-center justify-center cursor-pointer" onClick={() => previewImage && setLightboxUrl(previewImage)}>
                      {previewImage ? (
                        <img src={previewImage} alt={name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <ImageIcon className="h-10 w-10 text-muted-foreground/25" />
                      )}
                      <button
                        className={cn("absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/40 opacity-0 group-hover/preview:opacity-100 transition-opacity", thumbnailUploading && thumbnailTargetTemplate === name && "opacity-100")}
                        title="Upload thumbnail"
                        onClick={(e) => { e.stopPropagation(); setThumbnailTargetTemplate(name); thumbnailInputRef.current?.click(); }}
                      >
                        {thumbnailUploading && thumbnailTargetTemplate === name ? (
                          <span className="text-xs text-white">Uploading…</span>
                        ) : (
                          <><Camera className="h-5 w-5 text-white" /><span className="text-xs text-white font-medium">{previewImage ? "Replace thumbnail" : "Upload thumbnail"}</span></>
                        )}
                      </button>
                    </div>
                    <div className="p-4 flex flex-col gap-3 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm leading-tight text-foreground truncate">{name}</h3>
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {templateType && (
                              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", templateType === "video" ? "bg-violet-100 text-violet-800" : "bg-sky-100 text-sky-800")}>
                                {templateType === "video" ? "Video" : "Image"}
                              </span>
                            )}
                            {templateLink && (
                              <a href={templateLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors" title="Open template link">
                                <ExternalLink className="h-2.5 w-2.5" /> Template link
                              </a>
                            )}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 -mt-0.5"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setSettingsOriginalName(name); setSettingsName(name); setSettingsType(templateType); setSettingsLink(templateLink); setSettingsOpen(true); }}>
                              <Info className="mr-2 h-3.5 w-3.5" /> Settings
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setAddTemplateName(name); setAddOpen(true); }}>
                              <Plus className="mr-2 h-3.5 w-3.5" /> Add client
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTemplateName(name)}>
                              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete template
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(c).map(([clientName, gdriveUrl]) => {
                          const colorClass = accountColors[clientName] ?? CLIENT_COLORS[0];
                          return (
                            <span key={clientName} className={cn("group/pill inline-flex items-center gap-0 rounded-full text-[11px] font-semibold transition-colors", colorClass)}>
                              {gdriveUrl ? (
                                <a href={gdriveUrl} target="_blank" rel="noopener noreferrer" className="pl-2.5 pr-1 py-0.5 flex items-center gap-1">
                                  {clientName}<ExternalLink className="h-2.5 w-2.5 opacity-50" />
                                </a>
                              ) : (
                                <span className="pl-2.5 pr-1 py-0.5">{clientName}</span>
                              )}
                              <button className="pr-1.5 py-0.5 opacity-0 group-hover/pill:opacity-60 hover:!opacity-100 transition-opacity" title={`Edit ${clientName} production`}
                                onClick={() => { setEditProdOriginalTemplate(name); setEditProdTemplateName(name); setEditProdClient(clientName); setEditProdGdriveUrl(c[clientName] ?? ""); setEditProdOpen(true); }}>
                                <Info className="h-2.5 w-2.5" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-auto">{Object.keys(c).length} client{Object.keys(c).length !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ────────────── TAB 2: Ad Outputs ────────────── */}
          <TabsContent value="outputs">
            {/* Toolbar */}
            <div className="mb-6 flex flex-wrap items-center gap-2 justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Select value={outputsFilterClient} onValueChange={setOutputsFilterClient}>
                  <SelectTrigger className="w-[180px] h-9 text-xs"><SelectValue placeholder="All Clients" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {accounts.map((a) => <SelectItem key={a.id} value={a.account_name}>{a.account_name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={outputsFilterType} onValueChange={setOutputsFilterType}>
                  <SelectTrigger className="w-[140px] h-9 text-xs"><SelectValue placeholder="All Types" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="image_ads">Image Ads</SelectItem>
                    <SelectItem value="video_ads">Video Ads</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" className="gap-1.5" onClick={() => setUploadOpen(true)}>
                <Upload className="h-4 w-4" /> Upload Batch
              </Button>
            </div>

            {batchesLoading && (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
              </div>
            )}

            {!batchesLoading && filteredBatches.length === 0 && (
              <div className="flex flex-col items-center gap-4 py-20 text-center">
                <FolderOpen className="h-12 w-12 text-muted-foreground/40" />
                <p className="text-lg font-medium text-foreground">No uploads yet</p>
                <p className="max-w-md text-sm text-muted-foreground">
                  Upload your first batch of ad creatives and they'll appear here alongside their Drive folder links.
                </p>
                <Button onClick={() => setUploadOpen(true)} className="gap-1.5">
                  <Upload className="h-4 w-4" /> Upload Batch
                </Button>
              </div>
            )}

            {!batchesLoading && filteredBatches.length > 0 && (
              <div className="space-y-3">
                {filteredBatches.map((batch) => {
                  const isExpanded = expandedBatches.has(batch.id);
                  const adTypeLabel = batch.ad_type === "image_ads" ? "Image Ads" : "Video Ads";
                  const adTypeColor = batch.ad_type === "image_ads"
                    ? "bg-sky-100 text-sky-800"
                    : "bg-violet-100 text-violet-800";

                  return (
                    <div key={batch.id} className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                      {/* Batch header */}
                      <div className="flex items-center gap-3 px-4 py-3">
                        <button
                          className="flex-1 flex items-center gap-3 text-left min-w-0"
                          onClick={() => toggleBatch(batch.id)}
                        >
                          <div className={cn("shrink-0 rounded-lg p-2", batch.ad_type === "image_ads" ? "bg-sky-50" : "bg-violet-50")}>
                            {batch.ad_type === "image_ads"
                              ? <ImageIcon className="h-4 w-4 text-sky-600" />
                              : <Film className="h-4 w-4 text-violet-600" />
                            }
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-foreground">{batch.account_name}</span>
                              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", adTypeColor)}>
                                {adTypeLabel}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {batch.template_name} · {batch.ad_angle} · {batch.offer_type}
                            </p>
                          </div>
                          <div className="shrink-0 text-right hidden sm:block">
                            <p className="text-xs text-muted-foreground">{format(new Date(batch.created_at), "MMM d, yyyy")}</p>
                            <p className="text-[11px] text-muted-foreground/70">{batch.file_count} file{batch.file_count !== 1 ? "s" : ""}</p>
                          </div>
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                        </button>

                        <div className="flex items-center gap-1 shrink-0">
                          {batch.gdrive_folder_url && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="Open in Drive">
                              <a href={batch.gdrive_folder_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            title="Delete batch"
                            onClick={() => setDeleteBatchId(batch.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Expanded content */}
                      {isExpanded && (
                        <div className="border-t border-border px-4 py-4">
                          {batch.notes && (
                            <p className="text-xs text-muted-foreground mb-4 bg-muted/50 rounded-lg px-3 py-2">
                              {batch.notes}
                            </p>
                          )}

                          {(!batch.uploads || batch.uploads.length === 0) ? (
                            <p className="text-xs text-muted-foreground text-center py-4">No files recorded</p>
                          ) : (
                            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-2">
                              {batch.uploads.map((upload) => {
                                const isVideo = isVideoMime(upload.mime_type);
                                const isImage = isImageMime(upload.mime_type);
                                return (
                                  <a
                                    key={upload.id}
                                    href={upload.gdrive_view_url ?? upload.storage_url ?? "#"}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group relative aspect-square rounded-lg overflow-hidden bg-muted border border-border hover:border-primary/40 transition-colors"
                                    title={upload.file_name}
                                  >
                                    {isImage && upload.storage_url ? (
                                      <img
                                        src={upload.storage_url}
                                        alt={upload.file_name}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                        loading="lazy"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-1">
                                        <Film className={cn("h-6 w-6", isVideo ? "text-violet-400" : "text-muted-foreground/50")} />
                                        <span className="text-[9px] text-muted-foreground text-center leading-tight line-clamp-2 px-1">
                                          {upload.file_name}
                                        </span>
                                      </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                  </a>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* ── Upload Batch Dialog ───────────────────────────────────────────── */}
        <Dialog open={uploadOpen} onOpenChange={(open) => { if (!open && !uploading) resetUploadForm(); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Upload Creative Batch</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Client */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Client</label>
                <Select value={uploadClient} onValueChange={setUploadClient} disabled={uploading}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.account_name}>
                        <span className="flex items-center gap-2">
                          {a.account_name}
                          {!accountDriveMap[a.account_name] && (
                            <span className="text-[10px] text-amber-600 font-medium">no Drive folder</span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {uploadClient && !accountDriveMap[uploadClient] && (
                  <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" />
                    This client has no Drive folder linked. Add one in their client profile.
                  </p>
                )}
              </div>

              {/* Ad Type */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Ad Type</label>
                <div className="flex gap-2">
                  {([["image_ads", "Image Ads"], ["video_ads", "Video Ads"]] as const).map(([val, label]) => (
                    <button
                      key={val}
                      disabled={uploading}
                      onClick={() => setUploadAdType(val)}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition-colors",
                        uploadAdType === val
                          ? val === "image_ads" ? "bg-sky-100 text-sky-800 border-sky-200" : "bg-violet-100 text-violet-800 border-violet-200"
                          : "border-border text-muted-foreground hover:border-muted-foreground"
                      )}
                    >
                      {val === "image_ads" ? <ImageIcon className="h-3.5 w-3.5" /> : <Film className="h-3.5 w-3.5" />}
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Batch metadata */}
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Template Name</label>
                  <Input placeholder="e.g. VSL v3, Static Square" value={uploadTemplate} onChange={(e) => setUploadTemplate(e.target.value)} disabled={uploading} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Ad Angle</label>
                  <Input placeholder="e.g. Pain Point, Before & After" value={uploadAngle} onChange={(e) => setUploadAngle(e.target.value)} disabled={uploading} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Offer Type</label>
                  <Input placeholder="e.g. Free Estimate, $99 Special" value={uploadOffer} onChange={(e) => setUploadOffer(e.target.value)} disabled={uploading} />
                </div>
              </div>

              {/* Folder name preview */}
              {folderName && (
                <div className="rounded-lg bg-muted/60 border border-border px-3 py-2 flex items-center gap-2">
                  <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground">
                    Drive folder: <span className="font-medium text-foreground">{folderName}</span>
                  </span>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Notes <span className="text-muted-foreground/50">(optional)</span>
                </label>
                <Textarea
                  placeholder="e.g. Round 2 revisions based on client feedback"
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  disabled={uploading}
                  className="resize-none text-sm"
                  rows={2}
                />
              </div>

              {/* Drop zone */}
              <div
                className={cn(
                  "relative rounded-xl border-2 border-dashed transition-colors",
                  isDragging ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50",
                  uploading && "pointer-events-none opacity-60"
                )}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={(e) => { if (e.target.files) addFilesToQueue(e.target.files); e.target.value = ""; }}
                />
                <div
                  className="flex flex-col items-center gap-2 py-8 cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className={cn("h-8 w-8", isDragging ? "text-primary" : "text-muted-foreground/40")} />
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">Drop files here or click to browse</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Images and videos accepted</p>
                  </div>
                </div>
              </div>

              {/* File queue */}
              {queuedFiles.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {queuedFiles.map((qf) => (
                    <div key={qf.id} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                      {qf.file.type.startsWith("video/")
                        ? <Film className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                        : <ImageIcon className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                      }
                      <span className="text-xs text-foreground flex-1 truncate">{qf.file.name}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{formatBytes(qf.file.size)}</span>
                      {qf.status === "uploading" && <Loader2 className="h-3.5 w-3.5 text-primary animate-spin shrink-0" />}
                      {qf.status === "done" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                      {qf.status === "error" && (
                        <span title={qf.error}>
                          <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                        </span>
                      )}
                      {qf.status === "pending" && !uploading && (
                        <button onClick={() => removeQueuedFile(qf.id)} className="text-muted-foreground hover:text-foreground transition-colors">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="mt-2">
              <Button variant="outline" onClick={resetUploadForm} disabled={uploading}>Cancel</Button>
              <Button onClick={handleUploadBatch} disabled={!canUpload} className="gap-1.5 min-w-[140px]">
                {uploading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
                ) : (
                  <><Upload className="h-4 w-4" /> Upload {queuedFiles.length > 0 ? `${queuedFiles.length} file${queuedFiles.length !== 1 ? "s" : ""}` : "Batch"}</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Add Production Dialog (Template Library) ─────────────────────── */}
        <Dialog open={addOpen} onOpenChange={(open) => { if (!open) resetAddForm(); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Add Client Production</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Template</label>
                <Input list="template-list" placeholder="Template name (e.g. Showers, Skin & Hair)" value={addTemplateName} onChange={(e) => setAddTemplateName(e.target.value)} />
                <datalist id="template-list">{existingTemplates.map((t) => <option key={t} value={t} />)}</datalist>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Client</label>
                <Select value={addClient} onValueChange={setAddClient}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.account_name}>{a.account_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Google Drive Link</label>
                <Input placeholder="https://drive.google.com/…" value={addGdriveUrl} onChange={(e) => setAddGdriveUrl(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Preview Image <span className="text-muted-foreground/60">(optional)</span></label>
                <div className="relative rounded-xl border-2 border-dashed border-border p-4 text-center">
                  <input type="file" accept="image/*" className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; setAddPreviewFile(f); setAddPreviewPreview(URL.createObjectURL(f)); }} />
                  {addPreviewPreview ? (
                    <div className="relative inline-block">
                      <img src={addPreviewPreview} alt="Preview" className="max-h-32 rounded-lg mx-auto" />
                      <button className="absolute -top-1 -right-1 bg-background rounded-full border border-border p-0.5"
                        onClick={(e) => { e.stopPropagation(); setAddPreviewFile(null); setAddPreviewPreview(null); }}>
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
              <Button variant="outline" onClick={resetAddForm}>Cancel</Button>
              <Button onClick={() => saveProduction.mutate()} disabled={!addTemplateName.trim() || !addClient || !addGdriveUrl.trim() || saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Template Settings Dialog ──────────────────────────────────────── */}
        <Dialog open={settingsOpen} onOpenChange={(open) => { if (!open) { setSettingsOpen(false); setSettingsSaving(false); } }}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Template Settings</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Name</label>
                <Input value={settingsName} onChange={(e) => setSettingsName(e.target.value)} placeholder="Template name" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Type</label>
                <div className="flex gap-2">
                  {(["image", "video"] as const).map((t) => (
                    <button key={t} onClick={() => setSettingsType(settingsType === t ? null : t)}
                      className={cn("flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors",
                        settingsType === t ? t === "video" ? "bg-violet-100 text-violet-800 border-violet-200" : "bg-sky-100 text-sky-800 border-sky-200" : "border-border text-muted-foreground hover:border-muted-foreground")}>
                      {t === "video" ? "Video" : "Image"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Template Link <span className="text-muted-foreground/60">(optional)</span></label>
                <Input value={settingsLink} onChange={(e) => setSettingsLink(e.target.value)} placeholder="https://drive.google.com/…" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSettingsOpen(false)}>Cancel</Button>
              <Button onClick={() => {
                const group = templateGroups.find((g) => g.name === settingsOriginalName);
                saveTemplateSettings.mutate({ originalName: settingsOriginalName, newName: settingsName.trim() || settingsOriginalName, type: settingsType, link: settingsLink.trim(), existingMetaId: group?.typeMeta?.id ?? null, accountName: group?.items[0]?.account_name ?? "_meta" });
              }} disabled={!settingsName.trim() || settingsSaving}>
                {settingsSaving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Edit Client Production Dialog ─────────────────────────────────── */}
        <Dialog open={editProdOpen} onOpenChange={(open) => { if (!open) { setEditProdOpen(false); setEditProdSaving(false); } }}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Edit Production — {editProdClient}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Template</label>
                <Input list="edit-template-list" placeholder="Template name" value={editProdTemplateName} onChange={(e) => setEditProdTemplateName(e.target.value)} />
                <datalist id="edit-template-list">{existingTemplates.map((t) => <option key={t} value={t} />)}</datalist>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Google Drive Link</label>
                <Input placeholder="https://drive.google.com/…" value={editProdGdriveUrl} onChange={(e) => setEditProdGdriveUrl(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditProdOpen(false)}>Cancel</Button>
              <Button onClick={() => updateClientProduction.mutate({ originalTemplate: editProdOriginalTemplate, originalClient: editProdClient, newTemplate: editProdTemplateName.trim(), newGdriveUrl: editProdGdriveUrl.trim() })} disabled={!editProdTemplateName.trim() || editProdSaving}>
                {editProdSaving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Lightbox ─────────────────────────────────────────────────────── */}
        <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
          <DialogContent className="max-w-4xl p-2">
            {lightboxUrl && <img src={lightboxUrl} alt="Preview" className="max-w-full max-h-[85vh] object-contain mx-auto rounded-lg" />}
          </DialogContent>
        </Dialog>

        {/* ── Delete Template Confirmation ──────────────────────────────────── */}
        <AlertDialog open={!!deleteTemplateName} onOpenChange={(open) => { if (!open) setDeleteTemplateName(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete "{deleteTemplateName}"?</AlertDialogTitle>
              <AlertDialogDescription>This will permanently delete this template and all client productions. This cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteTemplateName && deleteTemplate.mutate(deleteTemplateName)}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── Delete Batch Confirmation ──────────────────────────────────────── */}
        <AlertDialog open={!!deleteBatchId} onOpenChange={(open) => { if (!open) setDeleteBatchId(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this batch?</AlertDialogTitle>
              <AlertDialogDescription>This will permanently remove the batch record and any stored file thumbnails. Files already in Google Drive will not be deleted.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteBatchId && deleteBatch.mutate(deleteBatchId)}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Hidden shared thumbnail file input */}
        <input ref={thumbnailInputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file || !thumbnailTargetTemplate) return;
            const group = templateGroups.find((g) => g.name === thumbnailTargetTemplate);
            const accountName = group?.items[0]?.account_name ?? "template";
            uploadThumbnail.mutate({ templateName: thumbnailTargetTemplate, file, accountName });
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
};

export default Creatives;
