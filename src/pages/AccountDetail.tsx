import { useMemo, useState, useEffect } from "react";
import { useParams, useNavigate, Link as RouterLink } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCouplerData } from "@/hooks/useCouplerData";
import { useSettings } from "@/hooks/useSettings";
import { getPalette } from "@/components/dashboard/AccountCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  UserCircle2,
  Link2,
  ExternalLink,
  X,
  ClipboardList,
  Mail,
  Send,
  CheckCircle2,
  Clock,
  ImagePlus,
  SquareArrowOutUpRight,
  Phone,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE = 8;

const AccountDetail = () => {
  const { accountName } = useParams<{ accountName: string }>();
  const decodedName = decodeURIComponent(accountName ?? "");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: couplerData } = useCouplerData();
  const { settings } = useSettings();
  const changeLogOptions = settings.change_log_options ?? [];

  // ─── Account (stable UUID) ────────────────────────────────────────────────
  const { data: account } = useQuery({
    queryKey: ["account", decodedName],
    queryFn: async () => {
      const { data: existing } = await supabase
        .from("accounts")
        .select("id, account_name")
        .eq("account_name", decodedName)
        .maybeSingle();
      if (existing) return existing;
      const { data: inserted, error } = await supabase
        .from("accounts")
        .insert({ account_name: decodedName })
        .select("id, account_name")
        .single();
      if (error) throw error;
      return inserted;
    },
    staleTime: Infinity,
  });
  const accountId = account?.id ?? "";

  // ─── Campaigns (for change log dropdown) ─────────────────────────────────
  const campaigns = useMemo(() => {
    if (!couplerData) return [];
    const set = new Set<string>();
    couplerData
      .filter((r) => r["Account: Account name"] === decodedName)
      .forEach((r) => set.add(r["Campaign: Campaign name"]));
    return Array.from(set).sort();
  }, [couplerData, decodedName]);

  // ─── POC ──────────────────────────────────────────────────────────────────
  const [pocName, setPocName] = useState("");
  const [pocEmail, setPocEmail] = useState("");
  const [savingPoc, setSavingPoc] = useState(false);
  const [deletingPocId, setDeletingPocId] = useState<string | null>(null);

  const { data: pocs = [], isLoading: pocsLoading } = useQuery({
    queryKey: ["account-poc", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await (supabase as any)
        .from("account_poc")
        .select("id, name, email")
        .eq("account_id", accountId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as { id: string; name: string; email: string }[];
    },
    enabled: !!accountId,
  });

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const canAddPoc = pocName.trim().length > 0 && isValidEmail(pocEmail.trim());

  const handleAddPoc = async () => {
    if (!canAddPoc || savingPoc) return;
    setSavingPoc(true);
    const { data, error } = await (supabase as any)
      .from("account_poc")
      .insert({ account_id: accountId, name: pocName.trim(), email: pocEmail.trim() })
      .select("id, name, email")
      .single();
    if (error) {
      toast.error("Failed to add contact");
    } else {
      queryClient.setQueryData(["account-poc", accountId], (prev: any[]) => [...(prev ?? []), data]);
      setPocName("");
      setPocEmail("");
      toast.success("Contact added");
    }
    setSavingPoc(false);
  };

  const handleDeletePoc = async (id: string) => {
    setDeletingPocId(id);
    const { error } = await (supabase as any).from("account_poc").delete().eq("id", id);
    if (error) {
      toast.error("Failed to remove contact");
    } else {
      queryClient.setQueryData(["account-poc", accountId], (prev: any[]) =>
        (prev ?? []).filter((p: any) => p.id !== id)
      );
    }
    setDeletingPocId(null);
  };

  // ─── Account Links ────────────────────────────────────────────────────────
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [showLinkForm, setShowLinkForm] = useState(false);

  const { data: accountLinks = [] } = useQuery({
    queryKey: ["account-links", decodedName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_links")
        .select("*")
        .eq("account_name", decodedName)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const addLink = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("account_links").insert({
        account_name: decodedName,
        label: newLinkLabel.trim(),
        url: newLinkUrl.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["account-links", decodedName] });
      setNewLinkLabel("");
      setNewLinkUrl("");
      setShowLinkForm(false);
      toast.success("Link saved");
    },
    onError: () => toast.error("Failed to save link"),
  });

  const deleteLink = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("account_links").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["account-links", decodedName] }),
  });

  // ─── Campaign Updates (Change Log) ───────────────────────────────────────
  const [logPage, setLogPage] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [selectedLogOption, setSelectedLogOption] = useState("");
  const [details, setDetails] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const { data: updates = [] } = useQuery({
    queryKey: ["campaign-updates", decodedName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_updates")
        .select("*")
        .eq("account_name", decodedName)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => { setLogPage(0); }, [updates.length]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setImageFiles((prev) => [...prev, ...files]);
    setImagePreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
  };

  const removeImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const addUpdate = useMutation({
    mutationFn: async () => {
      setUploading(true);
      const uploadedUrls: string[] = [];
      for (const file of imageFiles) {
        const ext = file.name.split(".").pop();
        const path = `${decodedName}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("changelog-attachments")
          .upload(path, file);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage
          .from("changelog-attachments")
          .getPublicUrl(path);
        uploadedUrls.push(urlData.publicUrl);
      }
      const sepIdx = selectedLogOption.indexOf("||");
      const campaignName = sepIdx >= 0 ? selectedLogOption.slice(0, sepIdx) : selectedLogOption;
      const titleValue = sepIdx >= 0 ? selectedLogOption.slice(sepIdx + 2) : "";
      const { error } = await supabase.from("campaign_updates").insert({
        account_name: decodedName,
        campaign_name: campaignName,
        category: "other" as any,
        title: titleValue,
        details: details || null,
        link_url: linkUrl || null,
        image_url: uploadedUrls.length > 0 ? uploadedUrls.join(",") : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-updates", decodedName] });
      setSelectedLogOption("");
      setDetails("");
      setLinkUrl("");
      setImageFiles([]);
      setImagePreviews([]);
      setShowForm(false);
      setUploading(false);
      toast.success("Update logged");
    },
    onError: () => { setUploading(false); toast.error("Failed to log update"); },
  });

  const deleteUpdate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaign_updates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-updates", decodedName] });
      toast.success("Update deleted");
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "assigned" | "published" }) => {
      const { error } = await supabase.from("campaign_updates").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["campaign-updates", decodedName] }),
  });

  // ─── Per-entry Email Modal ────────────────────────────────────────────────
  const [selectedRecipient, setSelectedRecipient] = useState("");
  const [modalUpdate, setModalUpdate] = useState<(typeof updates)[number] | null>(null);
  const [modalDraft, setModalDraft] = useState<{ subject: string; body: string } | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalSending, setModalSending] = useState(false);

  const reportUrl = `https://reports.treatengine.com/report/${encodeURIComponent(decodedName)}`;
  const contactEmail: string = (account as any)?.contact_email ?? "";
  const getRecipientName = (email: string) => pocs.find((p) => p.email === email)?.name || "";

  const openEmailModal = async (update: (typeof updates)[number]) => {
    setModalUpdate(update);
    setModalDraft(null);
    setModalLoading(true);
    const firstEmail = contactEmail || pocs[0]?.email || "";
    setSelectedRecipient(firstEmail);
    try {
      const { data, error } = await supabase.functions.invoke("send-client-update", {
        body: {
          accountName: decodedName,
          recipientEmail: firstEmail || "preview@example.com",
          recipientName: getRecipientName(firstEmail),
          reportUrl,
          recentUpdates: [{
            date: new Date(update.created_at).toLocaleDateString(),
            title: (update as any).title || update.category,
            details: update.details,
          }],
          dateLabel: "All time",
          draftOnly: true,
        },
      });
      if (error) throw error;
      setModalDraft({ subject: data.subject, body: data.body });
    } catch {
      toast.error("Failed to generate email");
      setModalUpdate(null);
    } finally {
      setModalLoading(false);
    }
  };

  const sendModalEmail = async () => {
    if (!modalUpdate || !modalDraft || !selectedRecipient) return;
    setModalSending(true);
    try {
      const { data: sendData, error } = await supabase.functions.invoke("send-client-update", {
        body: {
          accountName: decodedName,
          recipientEmail: selectedRecipient,
          recipientName: getRecipientName(selectedRecipient),
          reportUrl,
          recentUpdates: [{
            date: new Date(modalUpdate.created_at).toLocaleDateString(),
            title: (modalUpdate as any).title || modalUpdate.category,
            details: modalUpdate.details,
          }],
          dateLabel: "All time",
        },
      });
      if (error) {
        const body = await (error as any)?.context?.json?.().catch(() => null);
        throw new Error(body?.error || error?.message);
      }
      if (sendData?.error) throw new Error(sendData.error);
      await supabase
        .from("campaign_updates")
        .update({ emailed_at: new Date().toISOString() } as any)
        .eq("id", modalUpdate.id);
      queryClient.invalidateQueries({ queryKey: ["campaign-updates", decodedName] });
      toast.success(`Email sent to ${selectedRecipient}`);
      setModalUpdate(null);
      setModalDraft(null);
    } catch (err: any) {
      toast.error(`Failed to send email: ${err?.message || "Unknown error"}`);
    } finally {
      setModalSending(false);
    }
  };

  const totalLogCount = updates.length;
  const pagedUpdates = updates.slice(logPage * PAGE_SIZE, logPage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:py-10 sm:px-6 lg:px-8">

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate("/")}
              className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg border border-border/60 bg-card text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-foreground truncate">{decodedName}</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Client management</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <RouterLink
              to={`/report/${encodeURIComponent(decodedName)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-md border border-border/60 bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <SquareArrowOutUpRight className="h-3.5 w-3.5" />
              Client Report
            </RouterLink>
            <RouterLink
              to={`/cc-report/${encodeURIComponent(decodedName)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-md border border-border/60 bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-sky-600 hover:bg-muted/50 transition-colors"
            >
              <Phone className="h-3.5 w-3.5" />
              CC Report
            </RouterLink>
          </div>
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────────────── */}
        <Tabs defaultValue="profile">
          <TabsList className="mb-6">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="changelog">
              Change Log
              {totalLogCount > 0 && (
                <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {totalLogCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Profile Tab ─────────────────────────────────────────────────── */}
          <TabsContent value="profile" className="space-y-6">

            {/* Points of Contact */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <UserCircle2 className="h-4 w-4 text-muted-foreground" />
                  Points of Contact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pocsLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : pocs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No contacts added yet.</p>
                ) : (
                  <div className="space-y-2">
                    {pocs.map((poc) => (
                      <div
                        key={poc.id}
                        className="group flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border/60 bg-muted/20"
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-primary">
                            {poc.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{poc.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{poc.email}</p>
                        </div>
                        <button
                          onClick={() => handleDeletePoc(poc.id)}
                          disabled={deletingPocId === poc.id}
                          className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          {deletingPocId === poc.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add contact form */}
                <div className="pt-2 border-t border-border/50 space-y-3">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Add Contact</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="poc-name" className="text-xs text-muted-foreground mb-1 block">Name</Label>
                      <Input
                        id="poc-name"
                        placeholder="Jane Smith"
                        value={pocName}
                        onChange={(e) => setPocName(e.target.value)}
                        className="h-9 text-sm"
                        onKeyDown={(e) => e.key === "Enter" && canAddPoc && !savingPoc && handleAddPoc()}
                      />
                    </div>
                    <div>
                      <Label htmlFor="poc-email" className="text-xs text-muted-foreground mb-1 block">Email</Label>
                      <Input
                        id="poc-email"
                        type="email"
                        placeholder="jane@company.com"
                        value={pocEmail}
                        onChange={(e) => setPocEmail(e.target.value)}
                        className="h-9 text-sm"
                        onKeyDown={(e) => e.key === "Enter" && canAddPoc && !savingPoc && handleAddPoc()}
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleAddPoc}
                    disabled={!canAddPoc || savingPoc || !accountId}
                    size="sm"
                    className="gap-1.5"
                  >
                    {savingPoc ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Add Contact
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Account Links */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                    Account Links
                    {accountLinks.length > 0 && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {accountLinks.length}
                      </span>
                    )}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setShowLinkForm((v) => !v)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Link
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {showLinkForm && (
                  <div className="flex items-end gap-2 rounded-xl border border-border p-3 bg-muted/20">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Label</Label>
                        <Input
                          placeholder="e.g. Ad Account"
                          value={newLinkLabel}
                          onChange={(e) => setNewLinkLabel(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">URL</Label>
                        <Input
                          placeholder="https://..."
                          value={newLinkUrl}
                          onChange={(e) => setNewLinkUrl(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        className="h-8"
                        disabled={!newLinkLabel.trim() || !newLinkUrl.trim() || addLink.isPending}
                        onClick={() => addLink.mutate()}
                      >
                        Save
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8"
                        onClick={() => { setShowLinkForm(false); setNewLinkLabel(""); setNewLinkUrl(""); }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {accountLinks.length === 0 && !showLinkForm ? (
                  <p className="text-sm text-muted-foreground py-2">No links added yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {accountLinks.map((link) => (
                      <div
                        key={link.id}
                        className="group flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/20 px-3 py-1.5 text-sm"
                      >
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-foreground hover:text-primary transition-colors"
                        >
                          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          {link.label}
                        </a>
                        <button
                          onClick={() => deleteLink.mutate(link.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive ml-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Change Log Tab ───────────────────────────────────────────────── */}
          <TabsContent value="changelog" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <ClipboardList className="h-4 w-4" />
                Campaign Updates
              </h2>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-8 text-xs"
                onClick={() => setShowForm((v) => !v)}
              >
                <Plus className="h-3.5 w-3.5" />
                Log Update
              </Button>
            </div>

            {/* Add update form */}
            {showForm && (
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <Select value={selectedLogOption} onValueChange={setSelectedLogOption}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select campaign & change type" />
                    </SelectTrigger>
                    <SelectContent>
                      {changeLogOptions.map((opt) => {
                        const pal = getPalette(opt.label, changeLogOptions);
                        return (
                          <SelectGroup key={opt.label}>
                            <SelectLabel className={`flex items-center gap-1.5 ${pal.label}`}>
                              <span className={`inline-block h-2 w-2 rounded-full ${pal.dot}`} />
                              {opt.label}
                            </SelectLabel>
                            {opt.sub_options.length > 0
                              ? opt.sub_options.map((sub) => (
                                  <SelectItem key={`${opt.label}||${sub}`} value={`${opt.label}||${sub}`}>
                                    <span className="flex items-center gap-1.5">
                                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${pal.dot} opacity-70`} />
                                      {sub}
                                    </span>
                                  </SelectItem>
                                ))
                              : <SelectItem value={`${opt.label}||`}>{opt.label}</SelectItem>}
                          </SelectGroup>
                        );
                      })}
                      {(() => {
                        const covered = new Set(changeLogOptions.map((o) => o.label));
                        const extra = campaigns.filter((c) => !covered.has(c));
                        if (extra.length === 0) return null;
                        return (
                          <SelectGroup>
                            <SelectLabel>Ad Campaigns</SelectLabel>
                            {extra.map((c) => (
                              <SelectItem key={`${c}||`} value={`${c}||`}>{c}</SelectItem>
                            ))}
                          </SelectGroup>
                        );
                      })()}
                    </SelectContent>
                  </Select>

                  <Textarea
                    placeholder="What changed? Add details…"
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    rows={3}
                    className="text-sm"
                  />

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="absolute inset-0 opacity-0 w-full cursor-pointer"
                        onChange={handleImageSelect}
                      />
                      <Button type="button" variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                        <ImagePlus className="h-3.5 w-3.5" /> Images
                      </Button>
                    </div>
                    <Input
                      placeholder="Link URL (optional)"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      className="h-8 text-sm flex-1"
                    />
                  </div>

                  {imagePreviews.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {imagePreviews.map((src, i) => (
                        <div key={i} className="relative w-14 h-14 rounded-lg overflow-hidden border border-border">
                          <img src={src} alt="Preview" className="w-full h-full object-cover" />
                          <button
                            className="absolute top-0.5 right-0.5 bg-background/80 rounded-full p-0.5"
                            onClick={() => removeImage(i)}
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => addUpdate.mutate()}
                      disabled={
                        !selectedLogOption ||
                        (!details.trim() && !imageFiles.length && !linkUrl.trim()) ||
                        addUpdate.isPending ||
                        uploading
                      }
                    >
                      {uploading ? "Uploading…" : "Log Update"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowForm(false);
                        setSelectedLogOption("");
                        setDetails("");
                        setLinkUrl("");
                        setImageFiles([]);
                        setImagePreviews([]);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Update entries */}
            {totalLogCount === 0 ? (
              <div className="flex flex-col items-center py-12 text-center gap-2">
                <ClipboardList className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No updates logged yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pagedUpdates.map((update) => (
                  <div
                    key={update.id}
                    className="group rounded-xl border border-border/60 bg-card p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="secondary"
                          className={`text-xs px-2 py-0.5 ${getPalette(update.campaign_name, changeLogOptions).badge}`}
                        >
                          <span
                            className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 ${getPalette(update.campaign_name, changeLogOptions).dot}`}
                          />
                          {(update as any).title || update.campaign_name || update.category}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {update.campaign_name}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {new Date(update.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>

                    {update.details && (
                      <p className="text-sm text-foreground leading-relaxed">{update.details}</p>
                    )}

                    {update.link_url && (
                      <a
                        href={update.link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {update.link_url}
                      </a>
                    )}

                    {update.image_url && (
                      <div className="flex flex-wrap gap-1.5">
                        {update.image_url.split(",").map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                            <img
                              src={url}
                              alt="Attachment"
                              className="h-16 w-16 rounded-lg object-cover border border-border hover:opacity-80 transition-opacity"
                            />
                          </a>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-border/40">
                      <div className="flex items-center gap-3">
                        {/* Status toggle */}
                        {(update as any).status === "published" ? (
                          <button
                            onClick={() => updateStatus.mutate({ id: update.id, status: "assigned" })}
                            className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium hover:opacity-70 transition-opacity"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Published
                          </button>
                        ) : (
                          <button
                            onClick={() => updateStatus.mutate({ id: update.id, status: "published" })}
                            className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium hover:opacity-70 transition-opacity"
                          >
                            <Clock className="h-3.5 w-3.5" /> Assigned
                          </button>
                        )}

                        {/* Email */}
                        {(update as any).emailed_at ? (
                          <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Emailed
                          </span>
                        ) : (update as any).status === "published" ? (
                          <button
                            onClick={() => openEmailModal(update)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary font-medium transition-colors"
                          >
                            <Mail className="h-3.5 w-3.5" /> Email Client
                          </button>
                        ) : null}
                      </div>

                      <button
                        onClick={() => deleteUpdate.mutate(update.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalLogCount > PAGE_SIZE && (
              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={logPage === 0}
                  onClick={() => setLogPage((p) => p - 1)}
                  className="gap-1 text-xs"
                >
                  <ChevronUp className="h-3.5 w-3.5" /> Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  {logPage * PAGE_SIZE + 1}–{Math.min(logPage * PAGE_SIZE + PAGE_SIZE, totalLogCount)} of {totalLogCount}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={(logPage + 1) * PAGE_SIZE >= totalLogCount}
                  onClick={() => setLogPage((p) => p + 1)}
                  className="gap-1 text-xs"
                >
                  Next <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Email Modal ──────────────────────────────────────────────────────── */}
      <Dialog
        open={!!modalUpdate}
        onOpenChange={(open) => { if (!open) { setModalUpdate(null); setModalDraft(null); } }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              Email Client
            </DialogTitle>
          </DialogHeader>

          <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-1.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-12 shrink-0">From</span>
              <span className="font-medium text-foreground">Treat Engine &lt;info@treatengine.com&gt;</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-12 shrink-0">Reply-to</span>
              <span className="text-foreground">info@treatleads.com</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-12 shrink-0">To</span>
              {pocs.length > 0 || contactEmail ? (
                <select
                  value={selectedRecipient}
                  onChange={(e) => setSelectedRecipient(e.target.value)}
                  className="flex-1 bg-transparent text-foreground font-medium text-xs border-none outline-none cursor-pointer"
                >
                  {contactEmail && <option value={contactEmail}>{contactEmail}</option>}
                  {pocs.map((poc) => (
                    <option key={poc.id} value={poc.email}>{poc.name} — {poc.email}</option>
                  ))}
                </select>
              ) : (
                <span className="italic text-destructive">No contact set — add one in the Profile tab</span>
              )}
            </div>
            {modalUpdate && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-12 shrink-0">Re</span>
                <span className="text-foreground">
                  {(modalUpdate as any).title || modalUpdate.category} — {modalUpdate.campaign_name}
                </span>
              </div>
            )}
          </div>

          {modalLoading && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 animate-pulse text-violet-500" />
              Drafting with AI…
            </div>
          )}

          {modalDraft && !modalLoading && (
            <div className="space-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Subject</p>
                <Input
                  value={modalDraft.subject}
                  onChange={(e) => setModalDraft({ ...modalDraft, subject: e.target.value })}
                  className="text-sm"
                />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Body</p>
                <Textarea
                  value={modalDraft.body}
                  onChange={(e) => setModalDraft({ ...modalDraft, body: e.target.value })}
                  rows={8}
                  className="text-sm"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setModalUpdate(null); setModalDraft(null); }}
            >
              Cancel
            </Button>
            {modalDraft && (
              <Button
                size="sm"
                className="gap-1.5"
                disabled={!selectedRecipient || modalSending}
                onClick={sendModalEmail}
              >
                <Send className="h-3.5 w-3.5" />
                {modalSending ? "Sending…" : "Send Email"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AccountDetail;
