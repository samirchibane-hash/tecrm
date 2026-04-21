import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Phone,
  CalendarCheck,
  Wrench,
  UserCheck,
  Plus,
  Trash2,
  Trophy,
  Gift,
  Clock,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { format, differenceInCalendarDays, parseISO } from "date-fns";

interface Props {
  accountId: string;
  accountName: string;
  isAdmin?: boolean;
}

type MetricType = "calls_made" | "appointments_set" | "installs_generated" | "unique_leads";

const METRIC_LABELS: Record<MetricType, string> = {
  calls_made: "Calls",
  appointments_set: "Appts",
  installs_generated: "Installs",
  unique_leads: "Leads",
};

const METRIC_ICONS: Record<MetricType, typeof Phone> = {
  calls_made: Phone,
  appointments_set: CalendarCheck,
  installs_generated: Wrench,
  unique_leads: UserCheck,
};

const METRIC_FIELDS: MetricType[] = ["calls_made", "unique_leads", "appointments_set", "installs_generated"];

function daysLeft(deadline: string): number {
  return differenceInCalendarDays(parseISO(deadline), new Date());
}

function progressPct(current: number, target: number) {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}

function monthLabel(ym: string) {
  return format(parseISO(ym + "-01"), "MMMM yyyy");
}

// ────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────
export function CallCenterDashboard({ accountId, accountName, isAdmin = false }: Props) {
  const queryClient = useQueryClient();

  // ── UI state ───────────────────────────────────────────────
  const [showIncentiveForm, setShowIncentiveForm] = useState(false);
  const [incentiveOpen, setIncentiveOpen] = useState(true);
  const [newSetterName, setNewSetterName] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [editingMetric, setEditingMetric] = useState<{
    setterId: string;
    date: string;
    field: MetricType;
    value: string;
  } | null>(null);
  const [incentiveForm, setIncentiveForm] = useState({
    title: "",
    description: "",
    metric_type: "appointments_set" as MetricType,
    target_type: "team" as "team" | "individual",
    target_value: "",
    participant_ids: null as string[] | null,
    bonus_amount: "",
    bonus_description: "",
    deadline: "",
  });

  // Canonical date for monthly metric rows: first of the selected month
  const monthDate = selectedMonth + "-01";

  function changeMonth(delta: number) {
    const [year, month] = selectedMonth.split("-").map(Number);
    const d = new Date(year, month - 1 + delta, 1);
    const next = format(d, "yyyy-MM");
    if (next < "2026-04") return;
    setSelectedMonth(next);
  }

  // ── Data queries ───────────────────────────────────────────
  const { data: setters = [] } = useQuery({
    queryKey: ["cc-setters", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_center_setters")
        .select("*")
        .eq("account_id", accountId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  const { data: metrics = [] } = useQuery({
    queryKey: ["cc-metrics", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_center_metrics")
        .select("*")
        .eq("account_id", accountId)
        .order("metric_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  const { data: incentives = [] } = useQuery({
    queryKey: ["cc-incentives", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_center_incentives")
        .select("*")
        .eq("account_id", accountId)
        .order("deadline");
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  // ── Derived totals ─────────────────────────────────────────
  const setterTotals = useMemo(() => {
    const map: Record<string, Record<MetricType, number>> = {};
    for (const m of metrics) {
      if (!map[m.setter_id]) {
        map[m.setter_id] = { calls_made: 0, appointments_set: 0, installs_generated: 0, unique_leads: 0 };
      }
      map[m.setter_id].calls_made += m.calls_made;
      map[m.setter_id].appointments_set += m.appointments_set;
      map[m.setter_id].installs_generated += m.installs_generated;
      map[m.setter_id].unique_leads += m.unique_leads;
    }
    return map;
  }, [metrics]);

  // Rows for the selected month (one per setter, stored against monthDate)
  const monthMetrics = useMemo(
    () => metrics.filter((m) => m.metric_date === monthDate),
    [metrics, monthDate]
  );

  const monthTotals = useMemo(() => monthMetrics.reduce(
    (acc, m) => ({
      calls: acc.calls + m.calls_made,
      appts: acc.appts + m.appointments_set,
      installs: acc.installs + m.installs_generated,
      leads: acc.leads + m.unique_leads,
    }),
    { calls: 0, appts: 0, installs: 0, leads: 0 }
  ), [monthMetrics]);

  // ── Mutations ──────────────────────────────────────────────
  const addSetter = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase
        .from("call_center_setters")
        .insert({ account_id: accountId, name });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cc-setters", accountId] });
      setNewSetterName("");
      toast.success("Setter added");
    },
    onError: () => toast.error("Failed to add setter"),
  });

  const deleteSetter = useMutation({
    mutationFn: async (setterId: string) => {
      const { error } = await supabase
        .from("call_center_setters")
        .delete()
        .eq("id", setterId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cc-setters", accountId] });
      queryClient.invalidateQueries({ queryKey: ["cc-metrics", accountId] });
      toast.success("Setter removed");
    },
  });

  const upsertMetric = useMutation({
    mutationFn: async ({
      setterId,
      date,
      field,
      value,
    }: {
      setterId: string;
      date: string;
      field: MetricType;
      value: number;
    }) => {
      const existing = metrics.find(
        (m) => m.setter_id === setterId && m.metric_date === date
      );
      if (existing) {
        const { error } = await supabase
          .from("call_center_metrics")
          .update({ [field]: value, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("call_center_metrics").insert({
          setter_id: setterId,
          account_id: accountId,
          metric_date: date,
          [field]: value,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cc-metrics", accountId] });
      setEditingMetric(null);
    },
    onError: () => toast.error("Failed to save metric"),
  });

  const addIncentive = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("call_center_incentives").insert({
        account_id: accountId,
        title: incentiveForm.title,
        description: incentiveForm.description || null,
        metric_type: incentiveForm.metric_type,
        target_type: incentiveForm.target_type,
        target_value: incentiveForm.target_value ? parseInt(incentiveForm.target_value, 10) : null,
        participant_ids: incentiveForm.participant_ids,
        bonus_amount: incentiveForm.bonus_amount ? parseFloat(incentiveForm.bonus_amount) : null,
        bonus_description: incentiveForm.bonus_description || null,
        deadline: incentiveForm.deadline,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cc-incentives", accountId] });
      setIncentiveForm({
        title: "",
        description: "",
        metric_type: "appointments_set",
        target_type: "team",
        target_value: "",
        participant_ids: null,
        bonus_amount: "",
        bonus_description: "",
        deadline: "",
      });
      setShowIncentiveForm(false);
      toast.success("Incentive added");
    },
    onError: () => toast.error("Failed to add incentive"),
  });

  const toggleIncentiveActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("call_center_incentives")
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cc-incentives", accountId] }),
  });

  const deleteIncentive = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("call_center_incentives")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cc-incentives", accountId] });
      toast.success("Incentive removed");
    },
  });

  // ── Inline metric save handler ─────────────────────────────
  function commitMetricEdit() {
    if (!editingMetric) return;
    const val = parseInt(editingMetric.value, 10);
    if (isNaN(val) || val < 0) {
      toast.error("Enter a valid number");
      return;
    }
    upsertMetric.mutate({
      setterId: editingMetric.setterId,
      date: editingMetric.date,
      field: editingMetric.field,
      value: val,
    });
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50/40 dark:border-sky-800 dark:bg-sky-950/20 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-sky-600 dark:text-sky-400" />
          <span className="text-sm font-semibold text-sky-700 dark:text-sky-300">
            Call Center Performance
          </span>
          <Badge className="bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 text-[10px] px-1.5 py-0">
            VIP
          </Badge>
        </div>
      </div>

      {/* ── Incentives / Gamification ────────────────────────── */}
      <div>
        <button
          onClick={() => setIncentiveOpen((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:opacity-80 transition-opacity w-full"
        >
          <Trophy className="h-3.5 w-3.5" />
          Incentives & Bonuses
          {incentiveOpen ? (
            <ChevronUp className="h-3 w-3 ml-auto" />
          ) : (
            <ChevronDown className="h-3 w-3 ml-auto" />
          )}
        </button>

        {incentiveOpen && (
          <div className="mt-2 space-y-2">
            {incentives.filter((i) => i.is_active).map((incentive) => {
              const isIndividual = incentive.target_type === "individual";
              const metric = incentive.metric_type as MetricType;
              const hasTarget = incentive.target_value != null;
              const participants = incentive.participant_ids as string[] | null;

              const eligibleSetters = participants
                ? setters.filter((s) => participants.includes(s.id))
                : setters;

              const setterRows = isIndividual
                ? eligibleSetters
                    .map((s) => ({
                      id: s.id,
                      name: s.name,
                      value: setterTotals[s.id]?.[metric] ?? 0,
                    }))
                    .sort((a, b) => b.value - a.value)
                : [];

              const leaderValue = isIndividual ? (setterRows[0]?.value ?? 0) : 0;
              const anyAchieved = hasTarget && isIndividual && setterRows.some((r) => r.value >= incentive.target_value!);

              const teamCurrent = isIndividual
                ? leaderValue
                : eligibleSetters.reduce((sum, s) => sum + (setterTotals[s.id]?.[metric] ?? 0), 0);

              const current = teamCurrent;
              const pct = hasTarget ? progressPct(current, incentive.target_value!) : 0;
              const days = daysLeft(incentive.deadline);
              const isExpired = days < 0;
              const isAchieved = hasTarget
                ? (isIndividual ? anyAchieved : current >= incentive.target_value!)
                : false;

              return (
                <div
                  key={incentive.id}
                  className={`rounded-lg border p-3 space-y-2 ${
                    isAchieved
                      ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-700 dark:bg-emerald-950/30"
                      : isExpired
                      ? "border-red-200 bg-red-50/40 dark:border-red-800 dark:bg-red-950/20 opacity-70"
                      : "border-amber-200 bg-amber-50/40 dark:border-amber-800 dark:bg-amber-950/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isIndividual && (
                          <span className="text-[10px] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-400 bg-violet-100 dark:bg-violet-900/40 px-1.5 py-0.5 rounded-full">
                            Individual
                          </span>
                        )}
                        {isAchieved && (
                          <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 rounded-full">
                            {isIndividual ? "Winner!" : "Achieved!"}
                          </span>
                        )}
                        {isExpired && !isAchieved && (
                          <span className="text-[10px] font-bold uppercase tracking-wide text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40 px-1.5 py-0.5 rounded-full">
                            Expired
                          </span>
                        )}
                        <p className="text-xs font-semibold text-foreground">{incentive.title}</p>
                      </div>
                      {incentive.description && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">{incentive.description}</p>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() =>
                            toggleIncentiveActive.mutate({ id: incentive.id, is_active: false })
                          }
                          className="text-muted-foreground hover:text-foreground transition-colors text-[10px] underline"
                        >
                          Archive
                        </button>
                        <button
                          onClick={() => deleteIncentive.mutate(incentive.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {!isIndividual && hasTarget && (
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                        <span>{METRIC_LABELS[metric]}: {current} / {incentive.target_value}</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isAchieved ? "bg-emerald-500" : isExpired ? "bg-red-400" : pct >= 75 ? "bg-amber-400" : "bg-sky-400"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {isIndividual && (() => {
                    const leader = setterRows[0];
                    if (!leader) return null;
                    const leaderAchieved = hasTarget && leader.value >= incentive.target_value!;
                    const leaderPct = hasTarget ? progressPct(leader.value, incentive.target_value!) : 0;
                    return (
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-semibold ${leaderAchieved ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                          🏆 {leader.name}{leaderAchieved ? " ✓" : ""}
                        </span>
                        <span className="text-xs font-bold text-foreground">
                          {hasTarget ? `${leader.value} / ${incentive.target_value}` : leader.value} {METRIC_LABELS[metric]}
                          {hasTarget ? ` (${leaderPct}%)` : ""}
                        </span>
                      </div>
                    );
                  })()}

                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {isExpired
                        ? `Ended ${format(parseISO(incentive.deadline), "MMM d")}`
                        : isAchieved
                        ? `Deadline ${format(parseISO(incentive.deadline), "MMM d")}`
                        : `${days} day${days !== 1 ? "s" : ""} left — ${format(parseISO(incentive.deadline), "MMM d")}`}
                    </span>
                    {incentive.bonus_amount != null && (
                      <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                        <Gift className="h-3 w-3" />
                        +${incentive.bonus_amount.toFixed(0)}
                        {incentive.bonus_description ? ` — ${incentive.bonus_description}` : ""}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {incentives.filter((i) => !i.is_active).length > 0 && (
              <p className="text-[10px] text-muted-foreground">
                {incentives.filter((i) => !i.is_active).length} archived incentive
                {incentives.filter((i) => !i.is_active).length !== 1 ? "s" : ""} hidden
              </p>
            )}

            {isAdmin && showIncentiveForm ? (
              <div className="rounded-lg border border-border/60 bg-background/80 p-3 space-y-2">
                <p className="text-xs font-semibold text-foreground">New Incentive</p>

                <Input
                  placeholder="Title (e.g. April Install Push)"
                  value={incentiveForm.title}
                  onChange={(e) => setIncentiveForm((f) => ({ ...f, title: e.target.value }))}
                  className="h-7 text-xs"
                />
                <Input
                  placeholder="Description (optional)"
                  value={incentiveForm.description}
                  onChange={(e) => setIncentiveForm((f) => ({ ...f, description: e.target.value }))}
                  className="h-7 text-xs"
                />

                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Target Type</label>
                  <div className="mt-0.5 flex rounded-md border border-input overflow-hidden text-xs">
                    <button
                      type="button"
                      onClick={() => setIncentiveForm((f) => ({ ...f, target_type: "team" }))}
                      className={`flex-1 py-1 transition-colors ${
                        incentiveForm.target_type === "team"
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "bg-background text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Team
                    </button>
                    <button
                      type="button"
                      onClick={() => setIncentiveForm((f) => ({ ...f, target_type: "individual" }))}
                      className={`flex-1 py-1 transition-colors border-l border-input ${
                        incentiveForm.target_type === "individual"
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "bg-background text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Individual (first to hit)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Metric</label>
                    <select
                      value={incentiveForm.metric_type}
                      onChange={(e) =>
                        setIncentiveForm((f) => ({
                          ...f,
                          metric_type: e.target.value as MetricType,
                        }))
                      }
                      className="mt-0.5 w-full h-7 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="calls_made">Calls Made</option>
                      <option value="unique_leads">Unique Leads</option>
                      <option value="appointments_set">Appointments Set</option>
                      <option value="installs_generated">Installs Generated</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Target # (optional)</label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="e.g. 25 — or leave blank"
                      value={incentiveForm.target_value}
                      onChange={(e) =>
                        setIncentiveForm((f) => ({ ...f, target_value: e.target.value }))
                      }
                      className="mt-0.5 h-7 text-xs"
                    />
                  </div>
                </div>

                {incentiveForm.target_type === "individual" && setters.length > 0 && (
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      Competing reps (leave all unchecked for everyone)
                    </label>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {setters.map((s) => {
                        const selected = incentiveForm.participant_ids?.includes(s.id) ?? false;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() =>
                              setIncentiveForm((f) => {
                                const current = f.participant_ids ?? [];
                                const next = selected
                                  ? current.filter((id) => id !== s.id)
                                  : [...current, s.id];
                                return { ...f, participant_ids: next.length ? next : null };
                              })
                            }
                            className={`px-2 py-0.5 rounded-full border text-[11px] transition-colors ${
                              selected
                                ? "bg-primary text-primary-foreground border-primary font-semibold"
                                : "bg-background text-muted-foreground border-input hover:text-foreground"
                            }`}
                          >
                            {s.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Bonus $ (optional)</label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="e.g. 100"
                      value={incentiveForm.bonus_amount}
                      onChange={(e) =>
                        setIncentiveForm((f) => ({ ...f, bonus_amount: e.target.value }))
                      }
                      className="mt-0.5 h-7 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Deadline</label>
                    <Input
                      type="date"
                      value={incentiveForm.deadline}
                      onChange={(e) =>
                        setIncentiveForm((f) => ({ ...f, deadline: e.target.value }))
                      }
                      className="mt-0.5 h-7 text-xs"
                    />
                  </div>
                </div>

                <Input
                  placeholder="Bonus note (e.g. per install after 20 installs)"
                  value={incentiveForm.bonus_description}
                  onChange={(e) =>
                    setIncentiveForm((f) => ({ ...f, bonus_description: e.target.value }))
                  }
                  className="h-7 text-xs"
                />

                <div className="flex gap-2 justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => setShowIncentiveForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    disabled={
                      !incentiveForm.title.trim() ||
                      !incentiveForm.deadline ||
                      addIncentive.isPending
                    }
                    onClick={() => addIncentive.mutate()}
                  >
                    Save Incentive
                  </Button>
                </div>
              </div>
            ) : isAdmin ? (
              <button
                onClick={() => setShowIncentiveForm(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add incentive or bonus target
              </button>
            ) : null}
          </div>
        )}
      </div>

      {/* ── Month navigation ─────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => changeMonth(-1)}
            disabled={selectedMonth <= "2026-04"}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-foreground w-32 text-center">
            {monthLabel(selectedMonth)}
          </span>
          <button
            onClick={() => changeMonth(1)}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Add setter — admin only */}
        {isAdmin && (
          <div className="flex items-center gap-1.5">
            <Input
              placeholder="Setter name"
              value={newSetterName}
              onChange={(e) => setNewSetterName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newSetterName.trim()) {
                  addSetter.mutate(newSetterName.trim());
                }
              }}
              className="h-6 text-xs w-28 px-2"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2"
              disabled={!newSetterName.trim()}
              onClick={() => addSetter.mutate(newSetterName.trim())}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* ── Summary KPI row (monthly) ────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {(
          [
            { label: "Total Calls", value: monthTotals.calls, icon: Phone, color: "text-sky-600 dark:text-sky-400" },
            { label: "Unique Leads", value: monthTotals.leads, icon: UserCheck, color: "text-violet-600 dark:text-violet-400" },
            { label: "Appts Set", value: monthTotals.appts, icon: CalendarCheck, color: "text-emerald-600 dark:text-emerald-400" },
            { label: "Installs", value: monthTotals.installs, icon: Wrench, color: "text-amber-600 dark:text-amber-400" },
          ] as const
        ).map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="rounded-lg border border-border/60 bg-background/80 px-3 py-2.5 text-center"
          >
            <Icon className={`mx-auto mb-1 h-4 w-4 ${color}`} />
            <p className="text-lg font-bold text-foreground">{value.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Setter monthly totals table ──────────────────────── */}
      <div className="space-y-2">
        {setters.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            No setters added yet. Add a setter above to start tracking.
          </p>
        )}

        {setters.length > 0 && (
          <div className="rounded-lg border border-border/60 overflow-hidden">
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_70px_80px_70px_70px_28px] gap-0 bg-muted/40 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Setter</span>
              <span className="text-center">Calls</span>
              <span className="text-center">Uniq. Leads</span>
              <span className="text-center">Appts</span>
              <span className="text-center">Installs</span>
              <span />
            </div>

            {setters.map((setter) => {
              const row = monthMetrics.find((m) => m.setter_id === setter.id);

              return (
                <div
                  key={setter.id}
                  className="grid grid-cols-[1fr_70px_80px_70px_70px_28px] gap-0 border-t border-border/40 px-3 py-2 items-center hover:bg-muted/20 transition-colors"
                >
                  <span className="text-xs font-medium text-foreground truncate">{setter.name}</span>

                  {METRIC_FIELDS.map((field) => {
                    const val = row?.[field] ?? 0;
                    const isEditing =
                      editingMetric?.setterId === setter.id &&
                      editingMetric.date === monthDate &&
                      editingMetric.field === field;

                    return (
                      <div key={field} className="text-center">
                        {isAdmin && isEditing ? (
                          <div className="flex items-center justify-center gap-0.5">
                            <Input
                              type="number"
                              min={0}
                              value={editingMetric!.value}
                              onChange={(e) => setEditingMetric({ ...editingMetric!, value: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitMetricEdit();
                                if (e.key === "Escape") setEditingMetric(null);
                              }}
                              className="h-5 w-12 text-center text-xs px-1"
                              autoFocus
                            />
                            <button onClick={commitMetricEdit} className="text-green-600 hover:text-green-700">
                              <Check className="h-3 w-3" />
                            </button>
                            <button onClick={() => setEditingMetric(null)} className="text-muted-foreground hover:text-destructive">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : isAdmin ? (
                          <button
                            className="group flex items-center justify-center gap-0.5 w-full"
                            onClick={() =>
                              setEditingMetric({ setterId: setter.id, date: monthDate, field, value: String(val) })
                            }
                          >
                            <span className={`text-xs font-semibold ${val === 0 && !row ? "text-muted-foreground/40" : "text-foreground"}`}>
                              {val === 0 && !row ? "—" : val}
                            </span>
                            <Pencil className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        ) : (
                          <span className={`text-xs font-semibold ${val === 0 && !row ? "text-muted-foreground/40" : "text-foreground"}`}>
                            {val === 0 && !row ? "—" : val}
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {isAdmin ? (
                    <button
                      onClick={() => deleteSetter.mutate(setter.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors flex items-center justify-center"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  ) : <span />}
                </div>
              );
            })}

            {/* Team total row */}
            {setters.length > 1 && (
              <div className="grid grid-cols-[1fr_70px_80px_70px_70px_28px] gap-0 border-t border-border bg-muted/40 px-3 py-1.5 items-center">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Total</span>
                <span className="text-center text-xs font-bold text-foreground">{monthTotals.calls}</span>
                <span className="text-center text-xs font-bold text-foreground">{monthTotals.leads}</span>
                <span className="text-center text-xs font-bold text-foreground">{monthTotals.appts}</span>
                <span className="text-center text-xs font-bold text-foreground">{monthTotals.installs}</span>
                <span />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
