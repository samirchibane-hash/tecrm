import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/hooks/useSettings";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, ExternalLink, Globe, Tag, MessageSquare, CheckSquare, Copy, Link2, Zap, CheckCircle2, Loader2, ArrowRight, AlertCircle, FolderOpen, Layers } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type ActivationStep = "idle" | "meta" | "ghl" | "confirm" | "done";

interface MetaPreview {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  status: string;
  status_code: number;
}

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type BusinessHours = Record<string, { open: string; close: string; status: string }>;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">{title}</h3>
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        {children}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
      <span className="text-xs text-muted-foreground w-36 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

export default function ClientOnboarding() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { settings: appSettings } = useSettings();
  const [newComment, setNewComment] = useState("");
  const [authorName, setAuthorName] = useState(() => localStorage.getItem("te_author") ?? "");

  // Activation modal state
  const [activationStep, setActivationStep] = useState<ActivationStep>("idle");
  const [adAccountInput, setAdAccountInput] = useState("");
  const [metaPreview, setMetaPreview] = useState<MetaPreview | null>(null);
  const [metaError, setMetaError] = useState("");
  const [ghlLocationId, setGhlLocationId] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [activatedTecrmId, setActivatedTecrmId] = useState<string | null>(null);

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", clientId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  const { data: progress } = useQuery({
    queryKey: ["onboarding_progress", clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from("onboarding_progress").select("*").eq("client_id", clientId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!clientId,
  });

  const { data: comments } = useQuery({
    queryKey: ["onboarding_comments", clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from("onboarding_comments").select("*").eq("client_id", clientId!).order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!clientId,
  });

  const toggleItem = useMutation({
    mutationFn: async ({ itemKey, completed }: { itemKey: string; completed: boolean }) => {
      const { error } = await supabase.from("onboarding_progress").upsert({
        client_id: clientId!,
        item_key: itemKey,
        completed,
        completed_at: completed ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "client_id,item_key" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding_progress", clientId] }),
  });

  const addComment = useMutation({
    mutationFn: async () => {
      if (!newComment.trim() || !authorName.trim()) return;
      localStorage.setItem("te_author", authorName);
      const { error } = await supabase.from("onboarding_comments").insert({
        client_id: clientId!,
        author: authorName.trim(),
        content: newComment.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewComment("");
      qc.invalidateQueries({ queryKey: ["onboarding_comments", clientId] });
    },
  });

  const createDriveFolder = useMutation({
    mutationFn: async () => {
      if (!client) return;
      const clientName = client.business_name ?? client.full_name ?? "New Client";
      const { data, error } = await supabase.functions.invoke("create-gdrive-folder", {
        body: { client_id: clientId, client_name: clientName },
      });
      if (error || data?.error) throw new Error(data?.error ?? error?.message ?? "Failed to create folder");
      return data as { folder_url: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client", clientId] });
      toast.success("Google Drive folder created!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Check if this client is already activated (has an account_id)
  const isActivated = !!(client as any)?.account_id;

  async function validateMetaAccount() {
    setMetaError("");
    setIsValidating(true);
    try {
      const { data, error } = await supabase.functions.invoke("validate-meta-ad-account", {
        body: { ad_account_id: adAccountInput.trim() },
      });
      if (error || data?.error) {
        setMetaError(data?.error ?? error?.message ?? "Validation failed");
      } else {
        setMetaPreview(data as MetaPreview);
      }
    } catch {
      setMetaError("Could not reach validation service");
    } finally {
      setIsValidating(false);
    }
  }

  const activateClient = useMutation({
    mutationFn: async () => {
      if (!metaPreview || !client) return;
      const accountName = client.business_name ?? client.full_name ?? "New Client";

      // Upsert on account_name so re-activation updates rather than duplicates
      const { data: newAccount, error: accountError } = await supabase
        .from("accounts")
        .upsert(
          {
            account_name: accountName,
            fb_ad_account_id: metaPreview.id,
            ghl_location_id: ghlLocationId.trim() || null,
          },
          { onConflict: "account_name" }
        )
        .select("id")
        .single();
      if (accountError) throw new Error(accountError.message);

      // Link client to account
      const { error: linkError } = await supabase
        .from("clients")
        .update({ account_id: newAccount.id })
        .eq("id", clientId!);
      if (linkError) throw new Error(linkError.message);
      return newAccount.id;
    },
    onSuccess: (newId) => {
      setActivatedTecrmId(newId ?? null);
      setActivationStep("done");
      qc.invalidateQueries({ queryKey: ["client", clientId] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Client activated in CRM!");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  function resetActivation() {
    setActivationStep("idle");
    setAdAccountInput("");
    setMetaPreview(null);
    setMetaError("");
    setGhlLocationId("");
    setActivatedTecrmId(null);
  }

  const checklist = appSettings.onboarding_checklists[client?.service?.toLowerCase() ?? ""] ?? [];
  const completedKeys = new Set((progress ?? []).filter((p) => p.completed).map((p) => p.item_key));
  const totalItems = checklist.flatMap((s) => s.items).length;
  const completedCount = checklist.flatMap((s) => s.items).filter((i) => completedKeys.has(i.key)).length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Client not found.</p>
      </div>
    );
  }

  const businessHours = client.business_hours as BusinessHours | null;
  const amountFormatted = client.amount_paid
    ? `$${(client.amount_paid / 100).toLocaleString()}`
    : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-6 flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
                {client.business_name ?? client.full_name}
              </h1>
              {client.service && (
                <Badge variant="secondary" className="capitalize">{client.service}</Badge>
              )}
              {client.plan && (
                <Badge variant="outline" className="capitalize">{client.plan}</Badge>
              )}
              {isActivated && (
                <Badge className="bg-green-500/15 text-green-600 border-green-500/30 gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Active in CRM
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <p className="text-sm text-muted-foreground">
                Onboarded {client.submitted_at ? format(new Date(client.submitted_at), "MMM d, yyyy 'at' h:mm a") : "—"}
                {amountFormatted && <span className="ml-3 text-green-600 font-medium">{amountFormatted}</span>}
              </p>
              {(client as any)?.account_id && (
                <button
                  onClick={() => { navigator.clipboard.writeText((client as any).account_id); toast.success("TECRM ID copied"); }}
                  className="flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors font-mono"
                  title="Copy TECRM ID"
                >
                  TECRM: {((client as any).account_id as string).slice(0, 8)}…
                  <Copy className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          </div>
          {!isActivated && (
            <Button
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={() => setActivationStep("meta")}
            >
              <Zap className="h-3.5 w-3.5" />
              Activate in CRM
            </Button>
          )}
        </div>

        <Tabs defaultValue="profile">
          <TabsList className="mb-6">
            <TabsTrigger value="profile">Client Profile</TabsTrigger>
            <TabsTrigger value="onboarding">
              Onboarding
              {totalItems > 0 && (
                <span className="ml-2 text-xs text-muted-foreground">{completedCount}/{totalItems}</span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Profile Tab ── */}
          <TabsContent value="profile" className="space-y-6">

            <Section title="Business">
              <Field label="Business Name" value={client.business_name} />
              <Field label="Legal Name" value={client.legal_business_name} />
              <Field label="Business Type" value={client.business_type} />
              <Field label="EIN" value={client.ein} />
              <Field label="Location" value={client.city && client.state ? `${client.city}, ${client.state}` : null} />
              <Field label="Service Area" value={client.service_area} />
              {client.website_url && (
                <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
                  <span className="text-xs text-muted-foreground w-36 shrink-0 pt-0.5">Website</span>
                  <a href={client.website_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary flex items-center gap-1 hover:underline">
                    <Globe className="h-3.5 w-3.5" />
                    {client.website_url}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
              <Field label="Business Phone" value={client.business_phone} />
              <Field label="Business Email" value={client.business_email} />
            </Section>

            <Section title="Owner / Point of Contact">
              <Field label="Owner Name" value={client.owner_name} />
              <Field label="Owner Email" value={client.owner_email} />
              <Field label="Owner Cell" value={client.owner_cell} />
            </Section>

            <Section title="Service & Budget">
              <Field label="Service" value={client.service} />
              <Field label="Plan" value={client.plan} />
              <Field label="Ad Budget" value={client.ad_budget} />
              <Field label="Amount Paid" value={amountFormatted} />
              {client.brands && client.brands.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
                  <span className="text-xs text-muted-foreground w-36 shrink-0 pt-0.5">Brands</span>
                  <div className="flex flex-wrap gap-1.5">
                    {client.brands.map((b) => (
                      <Badge key={b} variant="secondary" className="text-xs">{b}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </Section>

            {client.offers && client.offers.length > 0 && (
              <Section title="Offers">
                <ul className="space-y-2">
                  {client.offers.map((offer, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Tag className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                      {offer}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {businessHours && (
              <Section title="Business Hours">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {DAY_ORDER.map((day) => {
                    const h = businessHours[day];
                    if (!h) return null;
                    const closed = h.status === "closed";
                    return (
                      <div key={day} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground w-24">{day}</span>
                        {closed ? (
                          <span className="text-muted-foreground italic text-xs">Closed</span>
                        ) : (
                          <span className="font-medium">{h.open} – {h.close}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}

            {client.additional_notes && (
              <Section title="Additional Notes">
                <p className="text-sm text-foreground whitespace-pre-wrap">{client.additional_notes}</p>
              </Section>
            )}

            <Section title="Social & Ads">
              <Field label="Has Facebook" value={client.has_facebook ? "Yes" : "No"} />
              {client.facebook_url && (
                <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
                  <span className="text-xs text-muted-foreground w-36 shrink-0 pt-0.5">Facebook URL</span>
                  <a href={client.facebook_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary flex items-center gap-1 hover:underline">
                    {client.facebook_url}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </Section>

          </TabsContent>

          {/* ── Onboarding Tab ── */}
          <TabsContent value="onboarding" className="space-y-6">

            {/* Onboarding link */}
            {client.session_id && (() => {
              const onboardingUrl = `https://treatengine.com/ads/onboarding?session_id=${client.session_id}`;
              return (
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold text-foreground">Onboarding Link</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { navigator.clipboard.writeText(onboardingUrl); toast.success("Link copied"); }}
                        className="flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                      >
                        <Copy className="h-3 w-3" />
                        Copy
                      </button>
                      <a
                        href={onboardingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Open
                      </a>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{onboardingUrl}</p>
                </div>
              );
            })()}

            {/* Google Drive folder */}
            {(() => {
              const driveUrl = (client as any).gdrive_folder_url as string | null;
              return (
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold text-foreground">Google Drive Folder</span>
                    </div>
                    {driveUrl ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { navigator.clipboard.writeText(driveUrl); toast.success("Link copied"); }}
                          className="flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                        >
                          <Copy className="h-3 w-3" />
                          Copy
                        </button>
                        <a
                          href={driveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Open
                        </a>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="gap-1.5 text-xs h-7"
                        onClick={() => createDriveFolder.mutate()}
                        disabled={createDriveFolder.isPending}
                      >
                        {createDriveFolder.isPending ? (
                          <><Loader2 className="h-3 w-3 animate-spin" /> Creating…</>
                        ) : (
                          <><FolderOpen className="h-3 w-3" /> Create Folder</>
                        )}
                      </Button>
                    )}
                  </div>
                  {driveUrl ? (
                    <p className="text-xs text-muted-foreground truncate">{driveUrl}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Creates a client folder with <span className="font-medium">Video Ads</span>, <span className="font-medium">Image Ads</span>, and <span className="font-medium">Brand & Systems</span> sub-folders.
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Claude Funnel */}
            {(() => {
              const clientName = client.business_name ?? client.full_name ?? ''
              const params = new URLSearchParams({
                clientName,
                city: client.city ?? '',
                state: client.state ?? '',
                phone: client.business_phone ?? '',
                tecrmId: (client as any).account_id ?? '',
              })
              return (
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold text-foreground">Claude Funnel</span>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="gap-1.5 text-xs h-7"
                      onClick={() => navigate(`/funnel-studio?${params.toString()}`)}
                    >
                      <Layers className="h-3 w-3" />
                      Launch Funnel Studio
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Generate a landing page funnel for <span className="font-medium">{clientName}</span> with client details pre-filled.
                  </p>
                </div>
              )
            })()}

            {/* Progress bar */}
            {totalItems > 0 && (
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Overall Progress</span>
                  <span className="text-sm font-bold">{completedCount} / {totalItems}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${(completedCount / totalItems) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Checklist */}
            {checklist.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-6 text-center">
                <CheckSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground mb-1">No checklist yet</p>
                <p className="text-xs text-muted-foreground">
                  The onboarding checklist for <span className="font-medium capitalize">{client.service ?? "this service"}</span> hasn't been set up yet.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {checklist.map((section) => (
                  <Section key={section.section} title={section.section}>
                    {section.items.map((item) => {
                      const checked = completedKeys.has(item.key);
                      return (
                        <div key={item.key} className="flex items-center gap-3">
                          <Checkbox
                            id={item.key}
                            checked={checked}
                            onCheckedChange={(v) => toggleItem.mutate({ itemKey: item.key, completed: !!v })}
                          />
                          <label
                            htmlFor={item.key}
                            className={`text-sm cursor-pointer select-none ${checked ? "line-through text-muted-foreground" : "text-foreground"}`}
                          >
                            {item.label}
                          </label>
                        </div>
                      );
                    })}
                  </Section>
                ))}
              </div>
            )}

            {/* Comments */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Team Comments</h3>

              <div className="rounded-xl border border-border bg-card divide-y divide-border">
                {(!comments || comments.length === 0) && (
                  <p className="text-sm text-muted-foreground p-4">No comments yet.</p>
                )}
                {comments?.map((c) => (
                  <div key={c.id} className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-foreground">{c.author}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(c.created_at), "MMM d, h:mm a")}
                      </span>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{c.content}</p>
                  </div>
                ))}

                {/* Add comment */}
                <div className="p-4 space-y-3 bg-muted/30">
                  <Input
                    placeholder="Your name"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    className="max-w-xs text-sm"
                  />
                  <Textarea
                    placeholder="Add a comment…"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={3}
                    className="text-sm resize-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addComment.mutate();
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={() => addComment.mutate()}
                    disabled={!newComment.trim() || !authorName.trim() || addComment.isPending}
                  >
                    <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                    Post Comment
                  </Button>
                </div>
              </div>
            </div>

          </TabsContent>
        </Tabs>
      </div>

      {/* ── Activation Modal ── */}
      <Dialog open={activationStep !== "idle"} onOpenChange={(open) => { if (!open) resetActivation(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Activate in CRM
            </DialogTitle>
            <DialogDescription>
              Link {client?.business_name ?? client?.full_name} to a Meta ad account to start tracking spend, leads, and appointments.
            </DialogDescription>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <span className={activationStep === "meta" ? "text-foreground font-semibold" : activationStep === "ghl" || activationStep === "confirm" || activationStep === "done" ? "text-green-600" : ""}>
              1. Meta Account
            </span>
            <span className="text-border">›</span>
            <span className={activationStep === "ghl" ? "text-foreground font-semibold" : activationStep === "confirm" || activationStep === "done" ? "text-green-600" : ""}>
              2. GHL Location
            </span>
            <span className="text-border">›</span>
            <span className={activationStep === "confirm" || activationStep === "done" ? "text-foreground font-semibold" : ""}>
              3. Confirm
            </span>
          </div>

          {/* Step 1: Meta Ad Account */}
          {activationStep === "meta" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Meta Ad Account ID</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="act_1234567890 or just the number"
                    value={adAccountInput}
                    onChange={(e) => { setAdAccountInput(e.target.value); setMetaPreview(null); setMetaError(""); }}
                    onKeyDown={(e) => { if (e.key === "Enter" && adAccountInput.trim()) validateMetaAccount(); }}
                  />
                  <Button
                    variant="secondary"
                    onClick={validateMetaAccount}
                    disabled={!adAccountInput.trim() || isValidating}
                  >
                    {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Validate"}
                  </Button>
                </div>
                {metaError && (
                  <div className="flex items-center gap-1.5 text-xs text-destructive">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {metaError}
                  </div>
                )}
              </div>

              {metaPreview && (
                <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-green-600 mb-2">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Account found
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <span className="text-muted-foreground text-xs">Name</span>
                    <span className="font-medium text-xs">{metaPreview.name}</span>
                    <span className="text-muted-foreground text-xs">Currency</span>
                    <span className="font-medium text-xs">{metaPreview.currency}</span>
                    <span className="text-muted-foreground text-xs">Timezone</span>
                    <span className="font-medium text-xs">{metaPreview.timezone}</span>
                    <span className="text-muted-foreground text-xs">Status</span>
                    <span className={`font-medium text-xs ${metaPreview.status_code === 1 ? "text-green-600" : "text-amber-600"}`}>
                      {metaPreview.status}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={resetActivation}>Cancel</Button>
                <Button
                  size="sm"
                  disabled={!metaPreview}
                  onClick={() => setActivationStep("ghl")}
                  className="gap-1"
                >
                  Continue
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: GHL Location */}
          {activationStep === "ghl" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">GHL Location ID <span className="text-muted-foreground font-normal">(optional)</span></label>
                <Input
                  placeholder="e.g. abc123XYZ..."
                  value={ghlLocationId}
                  onChange={(e) => setGhlLocationId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Found in GoHighLevel → Settings → Business Info → Location ID. This links GHL leads and appointments to this client.
                </p>
              </div>
              <div className="flex justify-between gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={() => setActivationStep("meta")}>Back</Button>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setActivationStep("confirm")}>Skip</Button>
                  <Button size="sm" onClick={() => setActivationStep("confirm")} className="gap-1">
                    Continue
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Confirm */}
          {activationStep === "confirm" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Summary</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Account name</span>
                    <span className="font-medium">{client?.business_name ?? client?.full_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Meta account</span>
                    <span className="font-medium">{metaPreview?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ad Account ID</span>
                    <span className="font-mono text-xs font-medium">{metaPreview?.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">GHL Location</span>
                    <span className="font-medium">{ghlLocationId.trim() || <span className="text-muted-foreground italic">—</span>}</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                This will create a new CRM account and immediately begin pulling ad spend data.
              </p>
              <div className="flex justify-between gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={() => setActivationStep("ghl")}>Back</Button>
                <Button
                  size="sm"
                  onClick={() => activateClient.mutate()}
                  disabled={activateClient.isPending}
                  className="gap-1.5"
                >
                  {activateClient.isPending ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Activating…</>
                  ) : (
                    <><Zap className="h-3.5 w-3.5" /> Activate Client</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Done */}
          {activationStep === "done" && (
            <div className="space-y-4 text-center py-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-green-500/15 p-4">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <div>
                <p className="font-semibold text-foreground">{client?.business_name ?? client?.full_name} is live!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Ad spend, leads, and appointments will now be tracked automatically.
                </p>
              </div>
              {activatedTecrmId && (
                <div className="rounded-lg border border-border bg-muted/40 p-3 text-left">
                  <p className="text-xs text-muted-foreground mb-1.5">TECRM ID — paste this into the GHL sub-account</p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-foreground break-all">{activatedTecrmId}</span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(activatedTecrmId); toast.success("TECRM ID copied"); }}
                      className="shrink-0 flex items-center gap-1 rounded border border-border/60 bg-background px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Copy className="h-3 w-3" />
                      Copy
                    </button>
                  </div>
                </div>
              )}
              <Button
                size="sm"
                onClick={() => { resetActivation(); navigate(`/account/${encodeURIComponent(client?.business_name ?? client?.full_name ?? "")}`); }}
              >
                View Account Dashboard
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
