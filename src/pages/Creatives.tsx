import { useState, useMemo, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NewBriefDialog } from "@/components/creatives/NewBriefDialog";
import { RequestDetailSheet } from "@/components/creatives/RequestDetailSheet";
import { TemplateDetailSheet } from "@/components/creatives/TemplateDetailSheet";
import { TemplateLibraryTable } from "@/components/creatives/TemplateLibraryTable";
import { type CreativeRequest, type RequestStatus, STATUS_STEPS, STATUS_LABEL, STATUS_BADGE, STATUS_DOT } from "@/components/creatives/types";
import { format, formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Plus, X, Trash2, Image as ImageIcon, ExternalLink,
  Search, Camera, Film, Loader2, User, Check,
  ClipboardList, ChevronsUpDown,
} from "lucide-react";
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


// ── Component ─────────────────────────────────────────────────────────────────

const Creatives = () => {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  // Active tab
  type TabId = "library" | "requests";
  const initialTab: TabId = searchParams.get("tab") === "requests" ? "requests" : "library";
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

  const [selectedTemplateGroup, setSelectedTemplateGroup] = useState<{
    name: string;
    templateType: "image" | "video" | null;
    templateLink: string;
    clients: Record<string, string | null>;
  } | null>(null);

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


  // ── Derived ───────────────────────────────────────────────────────────────

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

  // Column set for the library matrix: every client that actually appears in a visible
  // template row, ordered like the accounts list so column order is stable across renders.
  const clientColumns = useMemo(() => {
    const visibleTemplates = new Set(templateGroups.map((g) => g.name));
    const present = new Set<string>();
    templateGroups.forEach((g) => Object.keys(g.clients).forEach((c) => present.add(c)));
    requests.forEach((r) => { if (visibleTemplates.has(r.template_name)) present.add(r.account_name); });
    const known = accounts.map((a) => a.account_name).filter((n) => present.has(n));
    const unknown = [...present].filter((n) => !known.includes(n)).sort();
    const all = [...known, ...unknown];
    return filterAccount === "all" ? all : all.filter((n) => n === filterAccount);
  }, [templateGroups, requests, accounts, filterAccount]);

  const existingTemplates = useMemo(() =>
    [...new Set(creatives.map((c) => c.batch_name || "Uncategorized"))].sort(),
    [creatives]);

  const requestsByTemplate = useMemo(() => {
    const map: Record<string, { total: number; open: number }> = {};
    requests.forEach((r) => {
      if (!map[r.template_name]) map[r.template_name] = { total: 0, open: 0 };
      map[r.template_name].total++;
      if (r.status !== "launched") map[r.template_name].open++;
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
    const groups: Record<string, CreativeRequest[]> = { assigned: [], reviewing: [], approved: [], launched: [] };
    filteredRequests.forEach((r) => { groups[r.status]?.push(r); });
    return groups;
  }, [filteredRequests]);

  const openRequestCount = useMemo(() =>
    requests.filter((r) => r.status !== "launched").length, [requests]);

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

  // ── Form resets ───────────────────────────────────────────────────────────

  const resetAddForm = () => { setAddOpen(false); setAddTplComboOpen(false); setAddAdType("image"); setAddTemplateName(""); setAddClient(""); setAddGdriveUrl(""); setAddPreviewFile(null); setAddPreviewPreview(null); setSaving(false); };
  const resetNewTplForm = () => { setNewTplOpen(false); setNewTplName(""); setNewTplType(null); setNewTplLink(""); setNewTplFile(null); setNewTplPreview(null); setNewTplSaving(false); };


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
          </TabsList>

          {/* ────────────── TAB 1: Template Library ────────────── */}
          <TabsContent value="library">
            <div className="mb-6 flex flex-wrap items-center gap-2 justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input className="pl-8 h-9 w-[180px] text-xs" placeholder="Search templates…" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
                  <button
                    onClick={() => setFilterType(filterType === "image" ? "all" : "image")}
                    title="Image templates"
                    className={cn("rounded p-1.5 transition-colors", filterType === "image" ? "bg-sky-100 text-sky-700" : "text-muted-foreground hover:text-foreground hover:bg-muted")}
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setFilterType(filterType === "video" ? "all" : "video")}
                    title="Video templates"
                    className={cn("rounded p-1.5 transition-colors", filterType === "video" ? "bg-violet-100 text-violet-700" : "text-muted-foreground hover:text-foreground hover:bg-muted")}
                  >
                    <Film className="h-3.5 w-3.5" />
                  </button>
                </div>
                <Select value={filterAccount} onValueChange={setFilterAccount}>
                  <SelectTrigger className="w-[160px] h-9 text-xs"><SelectValue placeholder="All Clients" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All Clients</SelectItem>{accounts.map((a) => <SelectItem key={a.id} value={a.account_name}>{a.account_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setNewTplOpen(true)}><Plus className="h-4 w-4" /> New Template</Button>
                <Button size="sm" className="gap-1.5" onClick={() => setNewBriefOpen(true)}><ClipboardList className="h-4 w-4" /> New Brief</Button>
              </div>
            </div>

            {creativesLoading && <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-11 rounded-lg" />)}</div>}

            {!creativesLoading && templateGroups.length === 0 && (
              <div className="flex flex-col items-center gap-4 py-20 text-center">
                <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
                <p className="text-lg font-medium">No templates yet</p>
                <p className="max-w-md text-sm text-muted-foreground">Create a template first, then brief it out to your clients.</p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setNewTplOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" /> New Template</Button>
                  <Button onClick={() => setNewBriefOpen(true)} className="gap-1.5"><ClipboardList className="h-4 w-4" /> New Brief</Button>
                </div>
              </div>
            )}

            {!creativesLoading && templateGroups.length > 0 && (
              <TemplateLibraryTable
                rows={templateGroups}
                clientColumns={clientColumns}
                requests={requests}
                uploadingThumbnailFor={thumbnailUploading ? thumbnailTargetTemplate : null}
                onOpenTemplate={({ name, templateType, templateLink, clients }) =>
                  setSelectedTemplateGroup({ name, templateType, templateLink, clients })}
                onOpenRequest={(req) => setSelectedRequest(req)}
                onUploadThumbnail={(name) => { setThumbnailTargetTemplate(name); thumbnailInputRef.current?.click(); }}
                onOpenSettings={({ name, templateType, templateLink }) => {
                  setSettingsOriginalName(name); setSettingsName(name);
                  setSettingsType(templateType); setSettingsLink(templateLink); setSettingsOpen(true);
                }}
                onAddClient={(name) => { setAddTemplateName(name); setAddOpen(true); }}
                onDeleteTemplate={(name) => setDeleteTemplateName(name)}
              />
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

        </Tabs>

        {/* ── Template Detail Sheet ─────────────────────────────────────────── */}
        <TemplateDetailSheet
          group={selectedTemplateGroup}
          requests={selectedTemplateGroup ? requests.filter((r) => r.template_name === selectedTemplateGroup.name) : []}
          accountColors={accountColors}
          onClose={() => setSelectedTemplateGroup(null)}
          onSelectRequest={(req) => { setSelectedTemplateGroup(null); setSelectedRequest(req); }}
        />

        {/* ── Creative Request Detail Sheet ──────────────────────────────────── */}
        <RequestDetailSheet
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onRequestChange={(updated) => setSelectedRequest(updated)}
        />

        {/* ── New Brief Dialog ──────────────────────────────────────────────── */}
        <NewBriefDialog open={newBriefOpen} onOpenChange={setNewBriefOpen} />

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

        <input ref={thumbnailInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (!file || !thumbnailTargetTemplate) return; const group = templateGroups.find((g) => g.name === thumbnailTargetTemplate); uploadThumbnail.mutate({ templateName: thumbnailTargetTemplate, file, accountName: group?.items[0]?.account_name ?? "template" }); e.target.value = ""; }} />
      </div>
    </div>
  );
};

export default Creatives;
