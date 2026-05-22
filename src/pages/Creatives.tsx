import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NewBriefDialog } from "@/components/creatives/NewBriefDialog";
import { RequestDetailSheet } from "@/components/creatives/RequestDetailSheet";
import { type CreativeRequest, type RequestStatus, STATUS_STEPS, STATUS_LABEL, STATUS_BADGE, STATUS_DOT } from "@/components/creatives/types";
import { format, formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Plus, X, MoreVertical, Trash2, Image as ImageIcon, ExternalLink,
  Search, Info, Camera, Upload, Film, FolderOpen, ChevronDown, ChevronUp,
  AlertCircle, CheckCircle2, Loader2, Send, MessageSquare, User, Check,
  RotateCcw, ClipboardList, ChevronsUpDown,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── Types ────────────────────────────────────────────────────────────────────

type Creative = {
  id: string; account_name: string; batch_name: string | null;
  file_name: string; file_url: string; file_type: string;
  launch_date: string | null; created_at: string;
};


type CreativeBatch = {
  id: string; account_name: string; ad_type: string; template_name: string;
  ad_angle: string; offer_type: string; notes: string | null;
  gdrive_folder_id: string | null; gdrive_folder_url: string | null;
  file_count: number; created_at: string;
  uploads?: CreativeUpload[];
};

type CreativeUpload = {
  id: string; batch_id: string; file_name: string; storage_path: string | null;
  storage_url: string | null; gdrive_file_id: string | null; gdrive_view_url: string | null;
  mime_type: string | null; file_size: number | null; created_at: string;
};

type QueuedFile = {
  id: string; file: File; status: "pending" | "uploading" | "done" | "error"; error?: string;
  storageUrl?: string; storagePath?: string;
};


// ── Misc helpers ─────────────────────────────────────────────────────────────

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
function isVideoMime(m: string | null) { return !!m && m.startsWith("video/"); }
function isImageMime(m: string | null) { return !!m && m.startsWith("image/"); }

// ── Component ─────────────────────────────────────────────────────────────────

const Creatives = () => {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  // Active tab
  type TabId = "library" | "requests" | "outputs";
  const initialTab: TabId = searchParams.get("tab") === "outputs"
    ? "outputs" : searchParams.get("tab") === "requests"
    ? "requests" : "library";
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  // ── Template Library state ──────────────────────────────────────────────
  const [filterAccount, setFilterAccount] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addTplComboOpen, setAddTplComboOpen] = useState(false);
  const [addAdType, setAddAdType] = useState<"image" | "video">("image");
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

  // ── New Template dialog state ───────────────────────────────────────────
  const [newTplOpen, setNewTplOpen] = useState(false);
  const [newTplName, setNewTplName] = useState("");
  const [newTplType, setNewTplType] = useState<"image" | "video" | null>(null);
  const [newTplLink, setNewTplLink] = useState("");
  const [newTplFile, setNewTplFile] = useState<File | null>(null);
  const [newTplPreview, setNewTplPreview] = useState<string | null>(null);
  const [newTplSaving, setNewTplSaving] = useState(false);

  // ── Creative Requests state ─────────────────────────────────────────────
  const [reqFilterStatus, setReqFilterStatus] = useState("all");
  const [reqFilterClient, setReqFilterClient] = useState("all");
  const [reqFilterTemplate, setReqFilterTemplate] = useState("all");
  const [newBriefOpen, setNewBriefOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<CreativeRequest | null>(null);
  const [deleteRequestId, setDeleteRequestId] = useState<string | null>(null);

  // ── Ad Uploads state ────────────────────────────────────────────────────
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

  // Deep-link: ?upload=1 opens upload dialog
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


  const { data: creatives = [], isLoading: creativesLoading } = useQuery({
    queryKey: ["creatives"],
    queryFn: async () => {
      const { data, error } = await supabase.from("creatives").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      return data as Creative[];
    },
  });

  const { data: requests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ["creative-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creative_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CreativeRequest[];
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

  // ── Derived ───────────────────────────────────────────────────────────────

  const accountDriveMap = useMemo(() => {
    const map: Record<string, string | null> = {};
    accounts.forEach((a) => {
      map[a.account_name] = (a as any).gdrive_folder_url ?? null;
    });
    return map;
  }, [accounts]);

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
        const templateType: "image" | "video" | null = typeMeta && (typeMeta.file_name === "image" || typeMeta.file_name === "video") ? typeMeta.file_name : null;
        const templateLink: string = typeMeta?.file_url ?? "";
        const clientMap: Record<string, string | null> = {};
        items.forEach((i) => {
          if (i.file_type === "template_type") return;
          if (i.account_name === "_meta" || i.account_name === "") return;
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
    [creatives]);

  const requestsByTemplate = useMemo(() => {
    const map: Record<string, { total: number; open: number }> = {};
    requests.forEach((r) => {
      if (!map[r.template_name]) map[r.template_name] = { total: 0, open: 0 };
      map[r.template_name].total++;
      if (r.status !== "done") map[r.template_name].open++;
    });
    return map;
  }, [requests]);

  const addFilteredTemplates = useMemo(() => {
    const typed = new Set(
      creatives
        .filter((c) => c.file_type === "template_type" && c.file_name === addAdType)
        .map((c) => c.batch_name)
        .filter(Boolean) as string[]
    );
    return existingTemplates.filter((t) => typed.has(t));
  }, [creatives, existingTemplates, addAdType]);

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (reqFilterStatus !== "all" && r.status !== reqFilterStatus) return false;
      if (reqFilterClient !== "all" && r.account_name !== reqFilterClient) return false;
      if (reqFilterTemplate !== "all" && r.template_name !== reqFilterTemplate) return false;
      return true;
    });
  }, [requests, reqFilterStatus, reqFilterClient, reqFilterTemplate]);

  // Group requests by status for the kanban-style list
  const requestsByStatus = useMemo(() => {
    const groups: Record<string, CreativeRequest[]> = { requested: [], in_progress: [], in_review: [], done: [] };
    filteredRequests.forEach((r) => { groups[r.status]?.push(r); });
    return groups;
  }, [filteredRequests]);

  const filteredBatches = useMemo(() =>
    batches.filter((b) => {
      if (outputsFilterClient !== "all" && b.account_name !== outputsFilterClient) return false;
      if (outputsFilterType !== "all" && b.ad_type !== outputsFilterType) return false;
      return true;
    }), [batches, outputsFilterClient, outputsFilterType]);

  const openRequestCount = useMemo(() =>
    requests.filter((r) => r.status !== "done").length, [requests]);

  const deleteRequest = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("creative_requests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creative-requests"] });
      setDeleteRequestId(null);
      if (selectedRequest?.id === deleteRequestId) setSelectedRequest(null);
      toast.success("Request deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

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
        await supabase.from("creatives").insert({ account_name: addClient, batch_name: addTemplateName.trim(), file_name: addPreviewFile.name, file_url: urlData.publicUrl, file_type: "image", launch_date: null });
      }
      const { error } = await supabase.from("creatives").insert({ account_name: addClient, batch_name: addTemplateName.trim(), file_name: addGdriveUrl.trim(), file_url: addGdriveUrl.trim(), file_type: "link", launch_date: null });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["creatives"] }); resetAddForm(); toast.success("Production added"); },
    onError: (err: Error) => { setSaving(false); toast.error(`Failed: ${err.message}`); },
  });

  const saveTemplateSettings = useMutation({
    mutationFn: async ({ originalName, newName, type, link, existingMetaId, accountName }: { originalName: string; newName: string; type: "image" | "video" | null; link: string; existingMetaId: string | null; accountName: string; }) => {
      setSettingsSaving(true);
      if (newName !== originalName) {
        for (const item of creatives.filter((c) => (c.batch_name || "Uncategorized") === originalName)) {
          await supabase.from("creatives").update({ batch_name: newName }).eq("id", item.id);
        }
      }
      if (existingMetaId) {
        await supabase.from("creatives").update({ file_name: type ?? "", file_url: link, batch_name: newName }).eq("id", existingMetaId);
      } else if (type || link) {
        await supabase.from("creatives").insert({ account_name: accountName, batch_name: newName, file_name: type ?? "", file_url: link, file_type: "template_type", launch_date: null });
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["creatives"] }); setSettingsOpen(false); setSettingsSaving(false); toast.success("Template updated"); },
    onError: (err: Error) => { setSettingsSaving(false); toast.error(`Failed: ${err.message}`); },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (templateName: string) => {
      for (const item of creatives.filter((c) => (c.batch_name || "Uncategorized") === templateName)) {
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
    mutationFn: async ({ originalTemplate, originalClient, newTemplate, newGdriveUrl }: { originalTemplate: string; originalClient: string; newTemplate: string; newGdriveUrl: string; }) => {
      setEditProdSaving(true);
      for (const item of creatives.filter((c) => (c.batch_name || "Uncategorized") === originalTemplate && c.account_name === originalClient)) {
        const updates: Record<string, string | null> = {};
        if (newTemplate !== originalTemplate) updates.batch_name = newTemplate;
        if (item.file_type === "link" && newGdriveUrl !== item.file_url) { updates.file_url = newGdriveUrl; updates.file_name = newGdriveUrl; }
        if (Object.keys(updates).length > 0) await supabase.from("creatives").update(updates).eq("id", item.id);
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
      await supabase.from("creatives").insert({ account_name: accountName, batch_name: templateName, file_name: file.name, file_url: urlData.publicUrl, file_type: "image", launch_date: null });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["creatives"] }); setThumbnailTargetTemplate(null); setThumbnailUploading(false); toast.success("Thumbnail updated"); },
    onError: (err: Error) => { setThumbnailUploading(false); toast.error(`Upload failed: ${err.message}`); },
  });

  const saveNewTemplate = useMutation({
    mutationFn: async () => {
      if (!newTplName.trim()) return;
      setNewTplSaving(true);
      const { error } = await supabase.from("creatives").insert({
        account_name: "_meta",
        batch_name: newTplName.trim(),
        file_name: newTplType ?? "",
        file_url: newTplLink.trim(),
        file_type: "template_type",
        launch_date: null,
      });
      if (error) throw error;
      if (newTplFile) {
        const ext = newTplFile.name.split(".").pop();
        const path = `_meta/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("creatives").upload(path, newTplFile);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from("creatives").getPublicUrl(path);
        await supabase.from("creatives").insert({
          account_name: "_meta",
          batch_name: newTplName.trim(),
          file_name: newTplFile.name,
          file_url: urlData.publicUrl,
          file_type: "image",
          launch_date: null,
        });
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["creatives"] }); resetNewTplForm(); toast.success("Template created"); },
    onError: (err: Error) => { setNewTplSaving(false); toast.error(`Failed: ${err.message}`); },
  });

  // ── Ad Uploads mutation ───────────────────────────────────────────────────

  const deleteBatch = useMutation({
    mutationFn: async (batchId: string) => {
      const batch = batches.find((b) => b.id === batchId);
      if (batch?.uploads) for (const u of batch.uploads) if (u.storage_path) await supabase.storage.from("creative-outputs").remove([u.storage_path]);
      const { error } = await supabase.from("creative_batches").delete().eq("id", batchId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["creative-batches"] }); setDeleteBatchId(null); toast.success("Batch deleted"); },
    onError: (err: Error) => toast.error(`Failed: ${err.message}`),
  });

  // ── Upload flow ───────────────────────────────────────────────────────────

  const addFilesToQueue = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    const valid = arr.filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
    if (valid.length !== arr.length) toast.warning("Only image and video files are accepted");
    setQueuedFiles((prev) => [...prev, ...valid.map((f) => ({ id: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`, file: f, status: "pending" as const }))]);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); addFilesToQueue(e.dataTransfer.files); }, [addFilesToQueue]);

  const handleUploadBatch = async () => {
    if (!uploadClient || !uploadTemplate.trim() || !uploadAngle.trim() || !uploadOffer.trim() || queuedFiles.length === 0 || uploading) return;
    const driveUrl = accountDriveMap[uploadClient];
    if (!driveUrl) { toast.error("This client has no Google Drive folder linked."); return; }
    setUploading(true);
    const uploadedFiles: Array<{ storage_path: string; storage_url: string; file_name: string; mime_type: string; file_size: number; }> = [];
    for (const qf of queuedFiles) {
      setQueuedFiles((prev) => prev.map((f) => f.id === qf.id ? { ...f, status: "uploading" } : f));
      const ext = qf.file.name.split(".").pop();
      const path = `${uploadClient}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: storageErr } = await supabase.storage.from("creative-outputs").upload(path, qf.file);
      if (storageErr) { setQueuedFiles((prev) => prev.map((f) => f.id === qf.id ? { ...f, status: "error", error: storageErr.message } : f)); continue; }
      const { data: urlData } = supabase.storage.from("creative-outputs").getPublicUrl(path);
      setQueuedFiles((prev) => prev.map((f) => f.id === qf.id ? { ...f, status: "done", storageUrl: urlData.publicUrl, storagePath: path } : f));
      uploadedFiles.push({ storage_path: path, storage_url: urlData.publicUrl, file_name: qf.file.name, mime_type: qf.file.type, file_size: qf.file.size });
    }
    if (uploadedFiles.length === 0) { setUploading(false); toast.error("All files failed to upload"); return; }
    const { data, error } = await supabase.functions.invoke("upload-creatives-to-drive", { body: { account_name: uploadClient, ad_type: uploadAdType, template_name: uploadTemplate.trim(), ad_angle: uploadAngle.trim(), offer_type: uploadOffer.trim(), notes: uploadNotes.trim() || null, gdrive_parent_folder_url: driveUrl, files: uploadedFiles } });
    setUploading(false);
    if (error || data?.error) { toast.error(data?.error ?? "Failed to upload to Drive"); return; }
    queryClient.invalidateQueries({ queryKey: ["creative-batches"] });
    toast.success(`Batch uploaded — ${uploadedFiles.length} file${uploadedFiles.length !== 1 ? "s" : ""} sent to Drive`);
    resetUploadForm();
    setActiveTab("outputs");
  };

  // ── Form resets ───────────────────────────────────────────────────────────

  const resetAddForm = () => { setAddOpen(false); setAddTplComboOpen(false); setAddAdType("image"); setAddTemplateName(""); setAddClient(""); setAddGdriveUrl(""); setAddPreviewFile(null); setAddPreviewPreview(null); setSaving(false); };
  const resetNewTplForm = () => { setNewTplOpen(false); setNewTplName(""); setNewTplType(null); setNewTplLink(""); setNewTplFile(null); setNewTplPreview(null); setNewTplSaving(false); };
  const resetUploadForm = () => { setUploadOpen(false); setUploadClient(""); setUploadAdType("image_ads"); setUploadTemplate(""); setUploadAngle(""); setUploadOffer(""); setUploadNotes(""); setQueuedFiles([]); setUploading(false); };

  const toggleBatch = (id: string) => setExpandedBatches((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

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
            <p className="mt-1 text-sm text-muted-foreground">Template library, creative requests, and ad output management</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)}>
          <TabsList className="mb-6">
            <TabsTrigger value="library">Template Library</TabsTrigger>
            <TabsTrigger value="requests" className="gap-1.5">
              Creative Requests
              {openRequestCount > 0 && (
                <span className="rounded-full bg-primary text-primary-foreground text-[10px] font-semibold px-1.5 py-0.5 leading-none">
                  {openRequestCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="outputs">Ad Uploads</TabsTrigger>
          </TabsList>

          {/* ────────────── TAB 1: Template Library ────────────── */}
          <TabsContent value="library">
            <div className="mb-6 flex flex-wrap items-center gap-2 justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input className="pl-8 h-9 w-[180px] text-xs" placeholder="Search templates…" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[130px] h-9 text-xs"><SelectValue placeholder="All Types" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All Types</SelectItem><SelectItem value="image">Image</SelectItem><SelectItem value="video">Video</SelectItem></SelectContent>
                </Select>
                <Select value={filterAccount} onValueChange={setFilterAccount}>
                  <SelectTrigger className="w-[160px] h-9 text-xs"><SelectValue placeholder="All Clients" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All Clients</SelectItem>{accounts.map((a) => <SelectItem key={a.id} value={a.account_name}>{a.account_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setNewTplOpen(true)}><Plus className="h-4 w-4" /> New Template</Button>
                <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add Production</Button>
              </div>
            </div>

            {creativesLoading && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-[4/3] rounded-xl" />)}</div>}

            {!creativesLoading && templateGroups.length === 0 && (
              <div className="flex flex-col items-center gap-4 py-20 text-center">
                <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
                <p className="text-lg font-medium">No templates yet</p>
                <p className="max-w-md text-sm text-muted-foreground">Create a template first, then link client productions to it.</p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setNewTplOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" /> New Template</Button>
                  <Button onClick={() => setAddOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" /> Add Production</Button>
                </div>
              </div>
            )}

            {!creativesLoading && templateGroups.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {templateGroups.map(({ name, previewImage, templateType, templateLink, typeMeta, clients: c, items }) => {
                  const templateReqs = requests
                    .filter((r) => r.template_name === name)
                    .sort((a, b) => {
                      const dA = (a as any).updated_at ?? a.created_at;
                      const dB = (b as any).updated_at ?? b.created_at;
                      return dB.localeCompare(dA);
                    });
                  const recentBriefs = templateReqs.slice(0, 3);
                  const extraCount = Math.max(0, templateReqs.length - 3);
                  const clientCount = Object.keys(c).length;

                  return (
                    <div key={name} className="rounded-xl border border-border bg-card overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow">

                      {/* Thumbnail */}
                      <div className="group/preview relative aspect-video bg-muted flex items-center justify-center cursor-pointer" onClick={() => previewImage && setLightboxUrl(previewImage)}>
                        {previewImage ? <img src={previewImage} alt={name} className="w-full h-full object-cover" loading="lazy" /> : <ImageIcon className="h-10 w-10 text-muted-foreground/25" />}
                        <button className={cn("absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/40 opacity-0 group-hover/preview:opacity-100 transition-opacity", thumbnailUploading && thumbnailTargetTemplate === name && "opacity-100")} onClick={(e) => { e.stopPropagation(); setThumbnailTargetTemplate(name); thumbnailInputRef.current?.click(); }}>
                          {thumbnailUploading && thumbnailTargetTemplate === name ? <span className="text-xs text-white">Uploading…</span> : <><Camera className="h-5 w-5 text-white" /><span className="text-xs text-white font-medium">{previewImage ? "Replace thumbnail" : "Upload thumbnail"}</span></>}
                        </button>
                      </div>

                      {/* Card body */}
                      <div className="flex flex-col flex-1">

                        {/* Header */}
                        <div className="px-4 pt-3.5 pb-3 flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm leading-tight truncate">{name}</h3>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {templateType && (
                                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", templateType === "video" ? "bg-violet-100 text-violet-800" : "bg-sky-100 text-sky-800")}>
                                  {templateType === "video" ? "Video" : "Image"}
                                </span>
                              )}
                              {templateLink && (
                                <a href={templateLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                                  <ExternalLink className="h-2.5 w-2.5" /> Master
                                </a>
                              )}
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 -mt-0.5 -mr-1.5">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
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

                        <div className="border-t border-border/60 mx-4" />

                        {/* Brief feed — or client pills fallback */}
                        <div className="px-4 py-2 flex-1">
                          {recentBriefs.length > 0 ? (
                            <>
                              {recentBriefs.map((req) => {
                                const statusDot =
                                  req.status === "done"        ? "bg-emerald-500" :
                                  req.status === "in_review"   ? "bg-amber-400"   :
                                  req.status === "in_progress" ? "bg-blue-400"    : "bg-slate-300";
                                const clientColor = accountColors[req.account_name] ?? CLIENT_COLORS[0];
                                return (
                                  <div key={req.id} className="flex items-start gap-2.5 py-2 group/row border-b border-border/40 last:border-0">
                                    <span className={cn("h-1.5 w-1.5 rounded-full mt-[5px] shrink-0", statusDot)} title={STATUS_LABEL[req.status as RequestStatus]} />
                                    <div className="flex-1 min-w-0">
                                      <span className={cn("inline-flex rounded-full px-1.5 py-px text-[10px] font-semibold leading-tight", clientColor)}>
                                        {req.account_name}
                                      </span>
                                      <p className="text-[11px] text-muted-foreground truncate mt-0.5 leading-tight">
                                        {req.ad_angle} · {req.offer_type}
                                      </p>
                                    </div>
                                    {(req as any).gdrive_folder_url ? (
                                      <a
                                        href={(req as any).gdrive_folder_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        title="Open Drive folder"
                                        className="shrink-0 mt-0.5 p-1 rounded-md text-muted-foreground/30 hover:text-primary hover:bg-muted transition-all opacity-0 group-hover/row:opacity-100"
                                      >
                                        <FolderOpen className="h-3.5 w-3.5" />
                                      </a>
                                    ) : (
                                      <span className="shrink-0 w-[26px]" />
                                    )}
                                  </div>
                                );
                              })}
                              {extraCount > 0 && (
                                <button
                                  onClick={() => { setReqFilterTemplate(name); setActiveTab("requests"); }}
                                  className="mt-1 text-[11px] text-primary hover:underline"
                                >
                                  +{extraCount} more brief{extraCount !== 1 ? "s" : ""}
                                </button>
                              )}
                            </>
                          ) : clientCount > 0 ? (
                            <div className="flex flex-wrap gap-1.5 py-1">
                              {Object.entries(c).map(([clientName, gdriveUrl]) => {
                                const colorClass = accountColors[clientName] ?? CLIENT_COLORS[0];
                                return (
                                  <span key={clientName} className={cn("group/pill inline-flex items-center gap-0 rounded-full text-[11px] font-semibold transition-colors", colorClass)}>
                                    {gdriveUrl
                                      ? <a href={gdriveUrl} target="_blank" rel="noopener noreferrer" className="pl-2.5 pr-1 py-0.5 flex items-center gap-1">{clientName}<ExternalLink className="h-2.5 w-2.5 opacity-50" /></a>
                                      : <span className="pl-2.5 pr-1 py-0.5">{clientName}</span>}
                                    <button className="pr-1.5 py-0.5 opacity-0 group-hover/pill:opacity-60 hover:!opacity-100 transition-opacity" onClick={() => { setEditProdOriginalTemplate(name); setEditProdTemplateName(name); setEditProdClient(clientName); setEditProdGdriveUrl(c[clientName] ?? ""); setEditProdOpen(true); }}>
                                      <Info className="h-2.5 w-2.5" />
                                    </button>
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="py-3 text-[11px] text-muted-foreground/50 italic">No briefs yet — use New Brief to get started.</p>
                          )}
                        </div>

                        {/* Footer */}
                        <div className="border-t border-border/60 mx-4" />
                        <div className="px-4 py-2.5 flex items-center justify-between gap-2">
                          <p className="text-[11px] text-muted-foreground">
                            {templateReqs.length > 0
                              ? `${templateReqs.length} brief${templateReqs.length !== 1 ? "s" : ""} · ${clientCount} client${clientCount !== 1 ? "s" : ""}`
                              : `${clientCount} client${clientCount !== 1 ? "s" : ""}`}
                          </p>
                          {requestsByTemplate[name] && (
                            <button
                              onClick={() => { setReqFilterTemplate(name); setActiveTab("requests"); }}
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors",
                                requestsByTemplate[name].open > 0
                                  ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                                  : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                              )}
                            >
                              <ClipboardList className="h-2.5 w-2.5" />
                              {requestsByTemplate[name].open > 0
                                ? `${requestsByTemplate[name].open} open`
                                : `${requestsByTemplate[name].total} done`}
                            </button>
                          )}
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ────────────── TAB 2: Creative Requests ────────────── */}
          <TabsContent value="requests">
            {/* Toolbar */}
            <div className="mb-6 flex flex-wrap items-center gap-2 justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Select value={reqFilterStatus} onValueChange={setReqFilterStatus}>
                  <SelectTrigger className="w-[150px] h-9 text-xs"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {STATUS_STEPS.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={reqFilterClient} onValueChange={setReqFilterClient}>
                  <SelectTrigger className="w-[180px] h-9 text-xs"><SelectValue placeholder="All Clients" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All Clients</SelectItem>{accounts.map((a) => <SelectItem key={a.id} value={a.account_name}>{a.account_name}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={reqFilterTemplate} onValueChange={setReqFilterTemplate}>
                  <SelectTrigger className="w-[160px] h-9 text-xs"><SelectValue placeholder="All Templates" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Templates</SelectItem>
                    {existingTemplates.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                {reqFilterTemplate !== "all" && (
                  <button
                    onClick={() => setReqFilterTemplate("all")}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium hover:bg-primary/20 transition-colors"
                  >
                    {reqFilterTemplate} <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <Button size="sm" className="gap-1.5" onClick={() => setNewBriefOpen(true)}>
                <ClipboardList className="h-4 w-4" /> New Brief
              </Button>
            </div>

            {requestsLoading && <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>}

            {!requestsLoading && filteredRequests.length === 0 && (
              <div className="flex flex-col items-center gap-4 py-20 text-center">
                <ClipboardList className="h-12 w-12 text-muted-foreground/40" />
                <p className="text-lg font-medium">No creative requests yet</p>
                <p className="max-w-md text-sm text-muted-foreground">Create a brief to assign a creative task to your design team.</p>
                <Button onClick={() => setNewBriefOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" /> New Brief</Button>
              </div>
            )}

            {!requestsLoading && filteredRequests.length > 0 && (
              <div className="space-y-6">
                {(STATUS_STEPS.filter((s) => reqFilterStatus === "all" || reqFilterStatus === s) as RequestStatus[]).map((status) => {
                  const group = requestsByStatus[status] ?? [];
                  if (group.length === 0) return null;
                  return (
                    <div key={status}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[status])} />
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{STATUS_LABEL[status]}</h3>
                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{group.length}</span>
                      </div>
                      <div className="rounded-xl border border-border/60 overflow-hidden">
                        {group.map((req, i) => {
                          const isLast = i === group.length - 1;
                          return (
                            <div
                              key={req.id}
                              onClick={() => setSelectedRequest(req)}
                              className={cn("flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer group", !isLast && "border-b border-border/40")}
                            >
                              <div className={cn("shrink-0 rounded-lg p-1.5", req.ad_type === "image_ads" ? "bg-sky-50" : "bg-violet-50")}>
                                {req.ad_type === "image_ads" ? <ImageIcon className="h-3.5 w-3.5 text-sky-600" /> : <Film className="h-3.5 w-3.5 text-violet-600" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-semibold text-foreground">{req.account_name}</span>
                                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", req.ad_type === "image_ads" ? "bg-sky-100 text-sky-800" : "bg-violet-100 text-violet-800")}>
                                    {req.ad_type === "image_ads" ? "Image Ads" : "Video Ads"}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  {req.template_name} · {req.ad_angle} · {req.offer_type}
                                </p>
                              </div>
                              <div className="shrink-0 text-right hidden sm:block space-y-0.5">
                                {req.assigned_to ? (
                                  <p className="text-[11px] text-muted-foreground flex items-center gap-1 justify-end"><User className="h-2.5 w-2.5" />{req.assigned_to}</p>
                                ) : (
                                  <p className="text-[11px] text-muted-foreground/50 italic">Unassigned</p>
                                )}
                                <p className="text-[11px] text-muted-foreground/60">{formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}</p>
                              </div>
                              {req.gdrive_folder_url && (
                                <a href={req.gdrive_folder_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" title="Open Drive folder">
                                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                                </a>
                              )}
                              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                                onClick={(e) => { e.stopPropagation(); setDeleteRequestId(req.id); }}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ────────────── TAB 3: Ad Uploads ────────────── */}
          <TabsContent value="outputs">
            <div className="mb-6 flex flex-wrap items-center gap-2 justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Select value={outputsFilterClient} onValueChange={setOutputsFilterClient}>
                  <SelectTrigger className="w-[180px] h-9 text-xs"><SelectValue placeholder="All Clients" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All Clients</SelectItem>{accounts.map((a) => <SelectItem key={a.id} value={a.account_name}>{a.account_name}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={outputsFilterType} onValueChange={setOutputsFilterType}>
                  <SelectTrigger className="w-[140px] h-9 text-xs"><SelectValue placeholder="All Types" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All Types</SelectItem><SelectItem value="image_ads">Image Ads</SelectItem><SelectItem value="video_ads">Video Ads</SelectItem></SelectContent>
                </Select>
              </div>
              <Button size="sm" className="gap-1.5" onClick={() => setUploadOpen(true)}><Upload className="h-4 w-4" /> Upload Batch</Button>
            </div>

            {batchesLoading && <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>}

            {!batchesLoading && filteredBatches.length === 0 && (
              <div className="flex flex-col items-center gap-4 py-20 text-center">
                <FolderOpen className="h-12 w-12 text-muted-foreground/40" />
                <p className="text-lg font-medium">No uploads yet</p>
                <p className="max-w-md text-sm text-muted-foreground">Upload your first batch of ad creatives and they'll appear here alongside their Drive folder links.</p>
                <Button onClick={() => setUploadOpen(true)} className="gap-1.5"><Upload className="h-4 w-4" /> Upload Batch</Button>
              </div>
            )}

            {!batchesLoading && filteredBatches.length > 0 && (
              <div className="space-y-3">
                {filteredBatches.map((batch) => {
                  const isExpanded = expandedBatches.has(batch.id);
                  return (
                    <div key={batch.id} className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                      <div className="flex items-center gap-3 px-4 py-3">
                        <button className="flex-1 flex items-center gap-3 text-left min-w-0" onClick={() => toggleBatch(batch.id)}>
                          <div className={cn("shrink-0 rounded-lg p-2", batch.ad_type === "image_ads" ? "bg-sky-50" : "bg-violet-50")}>
                            {batch.ad_type === "image_ads" ? <ImageIcon className="h-4 w-4 text-sky-600" /> : <Film className="h-4 w-4 text-violet-600" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm">{batch.account_name}</span>
                              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", batch.ad_type === "image_ads" ? "bg-sky-100 text-sky-800" : "bg-violet-100 text-violet-800")}>{batch.ad_type === "image_ads" ? "Image Ads" : "Video Ads"}</span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{batch.template_name} · {batch.ad_angle} · {batch.offer_type}</p>
                          </div>
                          <div className="shrink-0 text-right hidden sm:block">
                            <p className="text-xs text-muted-foreground">{format(new Date(batch.created_at), "MMM d, yyyy")}</p>
                            <p className="text-[11px] text-muted-foreground/70">{batch.file_count} file{batch.file_count !== 1 ? "s" : ""}</p>
                          </div>
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                        </button>
                        <div className="flex items-center gap-1 shrink-0">
                          {batch.gdrive_folder_url && <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="Open in Drive"><a href={batch.gdrive_folder_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a></Button>}
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteBatchId(batch.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="border-t border-border px-4 py-4">
                          {batch.notes && <p className="text-xs text-muted-foreground mb-4 bg-muted/50 rounded-lg px-3 py-2">{batch.notes}</p>}
                          {(!batch.uploads || batch.uploads.length === 0) ? (
                            <p className="text-xs text-muted-foreground text-center py-4">No files recorded</p>
                          ) : (
                            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-2">
                              {batch.uploads.map((upload) => (
                                <a key={upload.id} href={upload.gdrive_view_url ?? upload.storage_url ?? "#"} target="_blank" rel="noopener noreferrer" className="group relative aspect-square rounded-lg overflow-hidden bg-muted border border-border hover:border-primary/40 transition-colors" title={upload.file_name}>
                                  {isImageMime(upload.mime_type) && upload.storage_url ? (
                                    <img src={upload.storage_url} alt={upload.file_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" loading="lazy" />
                                  ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-1">
                                      <Film className={cn("h-6 w-6", isVideoMime(upload.mime_type) ? "text-violet-400" : "text-muted-foreground/50")} />
                                      <span className="text-[9px] text-muted-foreground text-center leading-tight line-clamp-2 px-1">{upload.file_name}</span>
                                    </div>
                                  )}
                                </a>
                              ))}
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

        {/* ── Creative Request Detail Sheet ──────────────────────────────────── */}
        <RequestDetailSheet
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onRequestChange={(updated) => setSelectedRequest(updated)}
        />

        {/* ── New Brief Dialog ──────────────────────────────────────────────── */}
        <NewBriefDialog open={newBriefOpen} onOpenChange={setNewBriefOpen} />

        {/* ── Upload Batch Dialog ───────────────────────────────────────────── */}
        <Dialog open={uploadOpen} onOpenChange={(open) => { if (!open && !uploading) resetUploadForm(); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Upload Creative Batch</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Client</label>
                <Select value={uploadClient} onValueChange={setUploadClient} disabled={uploading}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.account_name}>
                        <span className="flex items-center gap-2">{a.account_name}{!accountDriveMap[a.account_name] && <span className="text-[10px] text-amber-600 font-medium">no Drive folder</span>}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {uploadClient && !accountDriveMap[uploadClient] && <p className="text-xs text-amber-600 flex items-center gap-1 mt-1"><AlertCircle className="h-3 w-3" />This client has no Drive folder linked.</p>}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Ad Type</label>
                <div className="flex gap-2">
                  {([["image_ads", "Image Ads"], ["video_ads", "Video Ads"]] as const).map(([val, label]) => (
                    <button key={val} disabled={uploading} onClick={() => setUploadAdType(val)}
                      className={cn("flex-1 flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition-colors",
                        uploadAdType === val ? val === "image_ads" ? "bg-sky-100 text-sky-800 border-sky-200" : "bg-violet-100 text-violet-800 border-violet-200" : "border-border text-muted-foreground hover:border-muted-foreground")}>
                      {val === "image_ads" ? <ImageIcon className="h-3.5 w-3.5" /> : <Film className="h-3.5 w-3.5" />}{label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {[["Template Name", uploadTemplate, setUploadTemplate, "e.g. VSL v3, Static Square"], ["Ad Angle", uploadAngle, setUploadAngle, "e.g. Pain Point, Before & After"], ["Offer Type", uploadOffer, setUploadOffer, "e.g. Free Estimate, $99 Special"]].map(([label, val, setter, ph]) => (
                  <div key={label as string} className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">{label as string}</label>
                    <Input placeholder={ph as string} value={val as string} onChange={(e) => (setter as React.Dispatch<React.SetStateAction<string>>)(e.target.value)} disabled={uploading} />
                  </div>
                ))}
              </div>
              {uploadTemplate && uploadAngle && uploadOffer && (
                <div className="rounded-lg bg-muted/60 border border-border px-3 py-2 flex items-center gap-2">
                  <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground">Folder: <span className="font-medium text-foreground">{uploadTemplate} - {uploadAngle} - {uploadOffer}</span></span>
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Notes <span className="text-muted-foreground/50">(optional)</span></label>
                <Textarea placeholder="e.g. Round 2 revisions based on client feedback" value={uploadNotes} onChange={(e) => setUploadNotes(e.target.value)} disabled={uploading} className="resize-none text-sm" rows={2} />
              </div>
              <div className={cn("relative rounded-xl border-2 border-dashed transition-colors", isDragging ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50", uploading && "pointer-events-none opacity-60")}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop}>
                <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => { if (e.target.files) addFilesToQueue(e.target.files); e.target.value = ""; }} />
                <div className="flex flex-col items-center gap-2 py-8 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <Upload className={cn("h-8 w-8", isDragging ? "text-primary" : "text-muted-foreground/40")} />
                  <div className="text-center">
                    <p className="text-sm font-medium">Drop files here or click to browse</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Images and videos accepted</p>
                  </div>
                </div>
              </div>
              {queuedFiles.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {queuedFiles.map((qf) => (
                    <div key={qf.id} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                      {qf.file.type.startsWith("video/") ? <Film className="h-3.5 w-3.5 text-violet-500 shrink-0" /> : <ImageIcon className="h-3.5 w-3.5 text-sky-500 shrink-0" />}
                      <span className="text-xs flex-1 truncate">{qf.file.name}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{formatBytes(qf.file.size)}</span>
                      {qf.status === "uploading" && <Loader2 className="h-3.5 w-3.5 text-primary animate-spin shrink-0" />}
                      {qf.status === "done" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                      {qf.status === "error" && <span title={qf.error}><AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" /></span>}
                      {qf.status === "pending" && !uploading && <button onClick={() => setQueuedFiles((p) => p.filter((f) => f.id !== qf.id))} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter className="mt-2">
              <Button variant="outline" onClick={resetUploadForm} disabled={uploading}>Cancel</Button>
              <Button onClick={handleUploadBatch} disabled={!canUpload} className="gap-1.5 min-w-[140px]">
                {uploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</> : <><Upload className="h-4 w-4" /> Upload {queuedFiles.length > 0 ? `${queuedFiles.length} file${queuedFiles.length !== 1 ? "s" : ""}` : "Batch"}</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── New Template Dialog ───────────────────────────────────────────── */}
        <Dialog open={newTplOpen} onOpenChange={(open) => { if (!open) resetNewTplForm(); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>New Template</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Template Name <span className="text-destructive">*</span></label>
                <Input
                  placeholder="e.g. IMG001, VSL-Hero, Static-Square"
                  value={newTplName}
                  onChange={(e) => setNewTplName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Type <span className="text-muted-foreground/50">(optional)</span></label>
                <div className="flex gap-2">
                  {(["image", "video"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setNewTplType(newTplType === t ? null : t)}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition-colors",
                        newTplType === t
                          ? t === "video" ? "bg-violet-100 text-violet-800 border-violet-200" : "bg-sky-100 text-sky-800 border-sky-200"
                          : "border-border text-muted-foreground hover:border-muted-foreground"
                      )}
                    >
                      {t === "video" ? <Film className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}
                      {t === "video" ? "Video" : "Image"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Master Template Link <span className="text-muted-foreground/50">(optional)</span></label>
                <Input
                  placeholder="https://drive.google.com/…"
                  value={newTplLink}
                  onChange={(e) => setNewTplLink(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Thumbnail <span className="text-muted-foreground/50">(optional)</span></label>
                <div className="relative rounded-xl border-2 border-dashed border-border p-4 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setNewTplFile(f);
                      setNewTplPreview(URL.createObjectURL(f));
                    }}
                  />
                  {newTplPreview ? (
                    <div className="relative inline-block">
                      <img src={newTplPreview} alt="Preview" className="max-h-32 rounded-lg mx-auto" />
                      <button
                        className="absolute -top-1 -right-1 bg-background rounded-full border border-border p-0.5"
                        onClick={(e) => { e.stopPropagation(); setNewTplFile(null); setNewTplPreview(null); }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 py-2">
                      <Camera className="h-5 w-5 text-muted-foreground/40" />
                      <p className="text-xs text-muted-foreground">Click to upload a thumbnail</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetNewTplForm}>Cancel</Button>
              <Button
                onClick={() => saveNewTemplate.mutate()}
                disabled={!newTplName.trim() || newTplSaving}
              >
                {newTplSaving ? "Creating…" : "Create Template"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Library dialogs ───────────────────────────────────────────────── */}
        <Dialog open={addOpen} onOpenChange={(open) => { if (!open) resetAddForm(); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Client Production</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">

              {/* Ad Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Ad Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ["image", "Image", <ImageIcon className="h-3.5 w-3.5" />] as const,
                    ["video", "Video", <Film className="h-3.5 w-3.5" />] as const,
                  ]).map(([val, label, icon]) => (
                    <button key={val} type="button"
                      onClick={() => { setAddAdType(val); setAddTemplateName(""); }}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-lg border py-2.5 text-xs font-semibold transition-all",
                        addAdType === val
                          ? val === "image" ? "bg-sky-50 text-sky-700 border-sky-300 shadow-sm" : "bg-violet-50 text-violet-700 border-violet-300 shadow-sm"
                          : "border-border text-muted-foreground hover:bg-muted/40 hover:border-muted-foreground/40"
                      )}>
                      {icon}{label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Template — searchable combobox filtered by ad type */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Template</label>
                <Popover open={addTplComboOpen} onOpenChange={setAddTplComboOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline" role="combobox" aria-expanded={addTplComboOpen}
                      className="w-full justify-between font-normal text-sm h-9"
                    >
                      <span className={cn("truncate", !addTemplateName && "text-muted-foreground")}>
                        {addTemplateName || "Select a template…"}
                      </span>
                      <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search templates…" className="h-8 text-sm" />
                      <CommandList>
                        <CommandEmpty>
                          <span className="text-xs text-muted-foreground">
                            No {addAdType} templates in library. Set a template type in Template Settings first.
                          </span>
                        </CommandEmpty>
                        <CommandGroup>
                          {addFilteredTemplates.map((t) => (
                            <CommandItem key={t} value={t} onSelect={(v) => { setAddTemplateName(v === addTemplateName ? "" : v); setAddTplComboOpen(false); }} className="text-sm">
                              <Check className={cn("mr-2 h-3.5 w-3.5 shrink-0", addTemplateName === t ? "opacity-100" : "opacity-0")} />
                              {t}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {addFilteredTemplates.length === 0 && (
                  <p className="text-[11px] text-amber-600">No {addAdType} templates found. Set template types in the Template Library first.</p>
                )}
              </div>

              {/* Client */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Client</label>
                <Select value={addClient} onValueChange={setAddClient}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => <SelectItem key={a.id} value={a.account_name}>{a.account_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Google Drive Link */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Google Drive Link</label>
                <Input
                  className="h-9 text-sm"
                  placeholder="https://drive.google.com/…"
                  value={addGdriveUrl}
                  onChange={(e) => setAddGdriveUrl(e.target.value)}
                />
              </div>

              {/* Preview Image */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Preview Image <span className="text-muted-foreground/50">(optional)</span>
                </label>
                <div className="relative rounded-xl border-2 border-dashed border-border p-4 text-center">
                  <input
                    type="file" accept="image/*"
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; setAddPreviewFile(f); setAddPreviewPreview(URL.createObjectURL(f)); }}
                  />
                  {addPreviewPreview ? (
                    <div className="relative inline-block">
                      <img src={addPreviewPreview} alt="Preview" className="max-h-32 rounded-lg mx-auto" />
                      <button className="absolute -top-1 -right-1 bg-background rounded-full border border-border p-0.5" onClick={(e) => { e.stopPropagation(); setAddPreviewFile(null); setAddPreviewPreview(null); }}>
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 py-2">
                      <Camera className="h-5 w-5 text-muted-foreground/40" />
                      <p className="text-xs text-muted-foreground">Click to upload a thumbnail</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetAddForm}>Cancel</Button>
              <Button
                onClick={() => saveProduction.mutate()}
                disabled={!addTemplateName.trim() || !addClient || !addGdriveUrl.trim() || saving}
                className="gap-1.5"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {saving ? "Saving…" : "Add Production"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={settingsOpen} onOpenChange={(open) => { if (!open) { setSettingsOpen(false); setSettingsSaving(false); } }}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Template Settings</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Name</label><Input value={settingsName} onChange={(e) => setSettingsName(e.target.value)} /></div>
              <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Type</label><div className="flex gap-2">{(["image", "video"] as const).map((t) => (<button key={t} onClick={() => setSettingsType(settingsType === t ? null : t)} className={cn("flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors", settingsType === t ? t === "video" ? "bg-violet-100 text-violet-800 border-violet-200" : "bg-sky-100 text-sky-800 border-sky-200" : "border-border text-muted-foreground hover:border-muted-foreground")}>{t === "video" ? "Video" : "Image"}</button>))}</div></div>
              <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Template Link <span className="text-muted-foreground/60">(optional)</span></label><Input value={settingsLink} onChange={(e) => setSettingsLink(e.target.value)} placeholder="https://drive.google.com/…" /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setSettingsOpen(false)}>Cancel</Button><Button onClick={() => { const group = templateGroups.find((g) => g.name === settingsOriginalName); saveTemplateSettings.mutate({ originalName: settingsOriginalName, newName: settingsName.trim() || settingsOriginalName, type: settingsType, link: settingsLink.trim(), existingMetaId: group?.typeMeta?.id ?? null, accountName: group?.items[0]?.account_name ?? "_meta" }); }} disabled={!settingsName.trim() || settingsSaving}>{settingsSaving ? "Saving…" : "Save"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={editProdOpen} onOpenChange={(open) => { if (!open) { setEditProdOpen(false); setEditProdSaving(false); } }}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Edit Production — {editProdClient}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Template</label><Input list="edit-template-list" value={editProdTemplateName} onChange={(e) => setEditProdTemplateName(e.target.value)} /><datalist id="edit-template-list">{existingTemplates.map((t) => <option key={t} value={t} />)}</datalist></div>
              <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Google Drive Link</label><Input value={editProdGdriveUrl} onChange={(e) => setEditProdGdriveUrl(e.target.value)} /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setEditProdOpen(false)}>Cancel</Button><Button onClick={() => updateClientProduction.mutate({ originalTemplate: editProdOriginalTemplate, originalClient: editProdClient, newTemplate: editProdTemplateName.trim(), newGdriveUrl: editProdGdriveUrl.trim() })} disabled={!editProdTemplateName.trim() || editProdSaving}>{editProdSaving ? "Saving…" : "Save"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
          <DialogContent className="max-w-4xl p-2">{lightboxUrl && <img src={lightboxUrl} alt="Preview" className="max-w-full max-h-[85vh] object-contain mx-auto rounded-lg" />}</DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteTemplateName} onOpenChange={(open) => { if (!open) setDeleteTemplateName(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Delete "{deleteTemplateName}"?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this template and all client productions.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteTemplateName && deleteTemplate.mutate(deleteTemplateName)}>Delete</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!deleteRequestId} onOpenChange={(open) => { if (!open) setDeleteRequestId(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Delete this creative request?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the brief and all its comments.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteRequestId && deleteRequest.mutate(deleteRequestId)}>Delete</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!deleteBatchId} onOpenChange={(open) => { if (!open) setDeleteBatchId(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Delete this batch?</AlertDialogTitle><AlertDialogDescription>Removes the batch record and stored thumbnails. Files in Google Drive are not deleted.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteBatchId && deleteBatch.mutate(deleteBatchId)}>Delete</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <input ref={thumbnailInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (!file || !thumbnailTargetTemplate) return; const group = templateGroups.find((g) => g.name === thumbnailTargetTemplate); uploadThumbnail.mutate({ templateName: thumbnailTargetTemplate, file, accountName: group?.items[0]?.account_name ?? "template" }); e.target.value = ""; }} />
      </div>
    </div>
  );
};

export default Creatives;
