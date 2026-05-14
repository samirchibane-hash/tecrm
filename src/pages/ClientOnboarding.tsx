import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ExternalLink, Globe, Phone, Mail, MapPin, Clock, DollarSign, Tag, MessageSquare, CheckSquare } from "lucide-react";
import { format } from "date-fns";

type ChecklistSection = { section: string; items: { key: string; label: string }[] };

const CHECKLISTS: Record<string, ChecklistSection[]> = {
  leads: [
    { section: "Access & Setup", items: [
      { key: "fb_access", label: "Facebook Ad Account Access Granted" },
      { key: "ghl_created", label: "GHL Sub-Account Created" },
      { key: "ghl_integrations", label: "GHL Integrations Configured" },
    ]},
    { section: "Strategy", items: [
      { key: "kickoff_scheduled", label: "Kickoff Call Scheduled" },
      { key: "kickoff_completed", label: "Kickoff Call Completed" },
      { key: "strategy_approved", label: "Campaign Strategy Approved" },
    ]},
    { section: "Creative", items: [
      { key: "brief_sent", label: "Creative Brief Sent to Client" },
      { key: "creatives_received", label: "First Creative Batch Received" },
      { key: "creatives_uploaded", label: "Creatives Uploaded to Portal" },
    ]},
    { section: "Launch", items: [
      { key: "campaigns_built", label: "Campaign Structure Built" },
      { key: "campaigns_live", label: "Campaigns Live" },
      { key: "first_report", label: "First Weekly Report Sent" },
    ]},
  ],
  // websites: [...],   // TODO: add when first Websites client is onboarded
  // cleardeals: [...], // TODO: add when first ClearDeals client is onboarded
};

function getChecklist(service: string | null): ChecklistSection[] {
  return CHECKLISTS[service?.toLowerCase() ?? ""] ?? [];
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
  const [newComment, setNewComment] = useState("");
  const [authorName, setAuthorName] = useState(() => localStorage.getItem("te_author") ?? "");

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

  const checklist = getChecklist(client?.service ?? null);
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
            </div>
            <p className="text-sm text-muted-foreground">
              Onboarded {client.submitted_at ? format(new Date(client.submitted_at), "MMM d, yyyy 'at' h:mm a") : "—"}
              {amountFormatted && <span className="ml-3 text-green-600 font-medium">{amountFormatted}</span>}
            </p>
          </div>
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
    </div>
  );
}
