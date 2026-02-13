import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  CalendarDays,
  Upload,
  Trash2,
  Image as ImageIcon,
  Filter,
  Plus,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SUPABASE_URL = "https://wyjxkkabuwuuvyzrsusy.supabase.co";

const Creatives = () => {
  const queryClient = useQueryClient();
  const [filterAccount, setFilterAccount] = useState<string>("all");
  const [filterBatch, setFilterBatch] = useState<string>("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [uploadAccount, setUploadAccount] = useState("");
  const [uploadBatch, setUploadBatch] = useState("");
  const [uploadLaunchDate, setUploadLaunchDate] = useState<Date | undefined>();
  const [uploading, setUploading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState("");

  // Fetch accounts
  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("*").order("account_name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch creatives
  const { data: creatives = [], isLoading } = useQuery({
    queryKey: ["creatives"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creatives")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Derived filters
  const batches = useMemo(() => {
    const set = new Set<string>();
    creatives.forEach((c) => { if (c.batch_name) set.add(c.batch_name); });
    return Array.from(set).sort();
  }, [creatives]);

  const filtered = useMemo(() => {
    return creatives.filter((c) => {
      if (filterAccount !== "all" && c.account_name !== filterAccount) return false;
      if (filterBatch !== "all" && c.batch_name !== filterBatch) return false;
      return true;
    });
  }, [creatives, filterAccount, filterBatch]);

  // Group by batch for display
  // Color palette for account badges
  const accountColors = useMemo(() => {
    const palette = [
      "bg-blue-100 text-blue-800", "bg-emerald-100 text-emerald-800",
      "bg-amber-100 text-amber-800", "bg-purple-100 text-purple-800",
      "bg-rose-100 text-rose-800", "bg-cyan-100 text-cyan-800",
      "bg-orange-100 text-orange-800", "bg-indigo-100 text-indigo-800",
    ];
    const map: Record<string, string> = {};
    const names = [...new Set(creatives.map((c) => c.account_name))].sort();
    names.forEach((name, i) => { map[name] = palette[i % palette.length]; });
    return map;
  }, [creatives]);

  const groupedByBatch = useMemo(() => {
    const map: Record<string, typeof filtered> = {};
    filtered.forEach((c) => {
      const key = c.batch_name || "Ungrouped";
      if (!map[key]) map[key] = [];
      map[key].push(c);
    });
    // Sort by most recent launch_date descending
    return Object.entries(map).sort(([, a], [, b]) => {
      const dateA = a.find((c) => c.launch_date)?.launch_date || "";
      const dateB = b.find((c) => c.launch_date)?.launch_date || "";
      return dateB.localeCompare(dateA);
    });
  }, [filtered]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setSelectedFiles((prev) => [...prev, ...files]);
    setFilePreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setFilePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadCreatives = useMutation({
    mutationFn: async () => {
      if (!uploadAccount || (selectedFiles.length === 0 && !linkUrl.trim())) return;
      setUploading(true);

      // Upload image files
      for (const file of selectedFiles) {
        const ext = file.name.split(".").pop();
        const path = `${uploadAccount}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("creatives").upload(path, file);
        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabase.storage.from("creatives").getPublicUrl(path);

        const { error: insertErr } = await supabase.from("creatives").insert({
          account_name: uploadAccount,
          batch_name: uploadBatch || "",
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_type: "image",
          launch_date: uploadLaunchDate ? format(uploadLaunchDate, "yyyy-MM-dd") : null,
        });
        if (insertErr) throw insertErr;
      }

      // Save link if provided
      if (linkUrl.trim()) {
        const { error: insertErr } = await supabase.from("creatives").insert({
          account_name: uploadAccount,
          batch_name: uploadBatch || "",
          file_name: linkUrl.trim(),
          file_url: linkUrl.trim(),
          file_type: "link",
          launch_date: uploadLaunchDate ? format(uploadLaunchDate, "yyyy-MM-dd") : null,
        });
        if (insertErr) throw insertErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creatives"] });
      resetUploadForm();
      toast.success("Creatives uploaded successfully");
    },
    onError: (err: Error) => {
      setUploading(false);
      toast.error(`Upload failed: ${err.message}`);
    },
  });

  const deleteCreative = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("creatives").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creatives"] });
      toast.success("Creative deleted");
    },
  });

  const resetUploadForm = () => {
    setUploadOpen(false);
    setSelectedFiles([]);
    setFilePreviews([]);
    setUploadAccount("");
    setUploadBatch("");
    setUploadLaunchDate(undefined);
    setUploading(false);
    setLinkUrl("");
  };


  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Creatives</h1>
              <p className="mt-1 text-sm text-muted-foreground">Manage client creatives by batch &amp; launch date</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Account Filter */}
            <Select value={filterAccount} onValueChange={setFilterAccount}>
              <SelectTrigger className="w-[180px] h-9 text-xs">
                <Filter className="mr-1.5 h-3.5 w-3.5" />
                <SelectValue placeholder="All Clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.account_name}>{a.account_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Batch Filter */}
            <Select value={filterBatch} onValueChange={setFilterBatch}>
              <SelectTrigger className="w-[160px] h-9 text-xs">
                <SelectValue placeholder="All Batches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Batches</SelectItem>
                {batches.map((b) => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button size="sm" className="gap-1.5" onClick={() => setUploadOpen(true)}>
              <Plus className="h-4 w-4" /> Upload
            </Button>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-xl" />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-lg font-medium text-foreground">No creatives yet</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Upload images and videos for your clients to organize them by batch and launch date.
            </p>
            <Button onClick={() => setUploadOpen(true)} className="gap-1.5">
              <Upload className="h-4 w-4" /> Upload Creatives
            </Button>
          </div>
        )}

        {/* Feed-style Creatives */}
        {groupedByBatch.map(([batchName, items]) => (
          <div key={batchName} className="mb-10">
            {/* Account badges */}
            <div className="mb-2 flex flex-wrap gap-1.5">
              {[...new Set(items.map((c) => c.account_name))].map((name) => (
                <span key={name} className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold", accountColors[name])}>
                  {name}
                </span>
              ))}
            </div>
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">{batchName}</h2>
              <Badge variant="secondary" className="text-xs">{items.length}</Badge>
              {items[0]?.launch_date && (
                <span className="text-xs text-muted-foreground">
                  <CalendarDays className="inline h-3 w-3 mr-0.5" />
                  {format(new Date(items[0].launch_date + "T00:00:00"), "MMM d, yyyy")}
                </span>
              )}
            </div>
            {/* Links */}
            {items.filter(c => c.file_type === "link").map((creative) => (
              <div key={creative.id} className="group flex items-center gap-3 py-1">
                <a
                  href={creative.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary underline underline-offset-2 hover:text-primary/80 truncate"
                >
                  {creative.file_name}
                </a>
                <span className="text-[11px] text-muted-foreground shrink-0">{creative.account_name}</span>
                <button
                  className="ml-auto rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => deleteCreative.mutate(creative.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              </div>
            ))}
            {/* Images in horizontal scroll */}
            {items.filter(c => c.file_type !== "link").length > 0 && (
              <div className="flex gap-3 overflow-x-auto pb-2 mt-2">
                {items.filter(c => c.file_type !== "link").map((creative) => (
                  <div key={creative.id} className="group relative shrink-0 w-48">
                    <img
                      src={creative.file_url}
                      alt={creative.file_name}
                      className="w-48 h-48 object-cover rounded-lg cursor-pointer"
                      loading="lazy"
                      onClick={() => setLightboxUrl(creative.file_url)}
                    />
                    <p className="mt-1 text-xs text-muted-foreground truncate">{creative.file_name}</p>
                    <button
                      className="absolute top-1.5 right-1.5 rounded-full bg-background/80 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => deleteCreative.mutate(creative.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Upload Dialog */}
        <Dialog open={uploadOpen} onOpenChange={(open) => { if (!open) resetUploadForm(); else setUploadOpen(true); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Upload Creatives</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Select value={uploadAccount} onValueChange={setUploadAccount}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.account_name}>{a.account_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                placeholder="Batch name (e.g. Feb 2025 - Batch 1)"
                value={uploadBatch}
                onChange={(e) => setUploadBatch(e.target.value)}
              />

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !uploadLaunchDate && "text-muted-foreground")}>
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {uploadLaunchDate ? format(uploadLaunchDate, "MMM d, yyyy") : "Launch date (optional)"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={uploadLaunchDate} onSelect={setUploadLaunchDate} />
                </PopoverContent>
              </Popover>

              {/* File drop zone */}
              <div className="relative rounded-xl border-2 border-dashed border-border p-6 text-center">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  onChange={handleFileSelect}
                />
                <Upload className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Drop images or click to browse</p>
              </div>

              {/* Link input */}
              <Input
                placeholder="GDrive or external link (optional)"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />

              {/* Preview grid */}
              {filePreviews.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {filePreviews.map((src, i) => (
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-border">
                      <img src={src} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        className="absolute top-0.5 right-0.5 bg-background/80 rounded-full p-0.5"
                        onClick={() => removeFile(i)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetUploadForm}>Cancel</Button>
              <Button
                onClick={() => uploadCreatives.mutate()}
                disabled={!uploadAccount || (selectedFiles.length === 0 && !linkUrl.trim()) || uploading}
              >
                {uploading ? "Uploading…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Lightbox */}
        <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
          <DialogContent className="max-w-3xl p-2">
            {lightboxUrl && (
              <img src={lightboxUrl} alt="Creative" className="w-full rounded-lg" />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Creatives;
