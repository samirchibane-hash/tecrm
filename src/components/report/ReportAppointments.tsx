import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ChevronRight, Plus, Search } from "lucide-react";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCount, formatPhone } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AddBookingDialog } from "./AddBookingDialog";
import { DealValueField, OutcomeSelect } from "./AppointmentControls";
import { AppointmentDialog } from "./AppointmentDialog";
import { APPT_STATUSES, apptStatusMeta } from "./reportConfig";
import { useAppointmentEditing, type GhlRow } from "./useAppointmentEditing";

const PER_PAGE = 10;
const NO_OUTCOME = "none";

const day = (iso: string | null, pattern: string) => (iso ? format(new Date(`${iso}T00:00:00`), pattern) : "—");
const initials = (name: string | null) =>
  (name ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("") || "?";

export function ReportAppointments({
  accountId,
  appointments,
  leads,
  loading,
  unmapped,
}: {
  accountId: string;
  /** Appointments in the reporting period. */
  appointments: GhlRow[];
  /** Every lead on the account, for prefilling a new booking. */
  leads: GhlRow[];
  loading: boolean;
  /** No GoHighLevel rows at all for this account. */
  unmapped: boolean;
}) {
  const edit = useAppointmentEditing(accountId);
  const [query, setQuery] = useState("");
  const [outcome, setOutcome] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const a of appointments) {
      const key = apptStatusMeta(a.appointment_status)?.value ?? NO_OUTCOME;
      c.set(key, (c.get(key) ?? 0) + 1);
    }
    return c;
  }, [appointments]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return appointments.filter((a) => {
      if (outcome && (apptStatusMeta(a.appointment_status)?.value ?? NO_OUTCOME) !== outcome) return false;
      if (!q) return true;
      return a.contact_name?.toLowerCase().includes(q) || String(a.contact_phone ?? "").includes(q);
    });
  }, [appointments, query, outcome]);

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const current = Math.min(page, pages - 1);
  const rows = filtered.slice(current * PER_PAGE, (current + 1) * PER_PAGE);
  const open = appointments.find((a) => a.ghl_contact_id === openId) ?? null;

  const chips = [
    ...APPT_STATUSES.map((s) => ({ value: s.value, label: s.label, status: s.status })),
    { value: NO_OUTCOME, label: "No outcome yet", status: "neutral" as const },
  ].filter((c) => counts.get(c.value));

  return (
    <section id="appointments" aria-labelledby="appointments-h" className="scroll-mt-16 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-0.5">
          <h2 id="appointments-h" className="text-[22px] font-semibold tracking-tight text-foreground">Appointments</h2>
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading…" : unmapped ? "GoHighLevel" : `${formatCount(appointments.length)} in this period · GoHighLevel`}
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <div className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              aria-label="Search appointments by name or phone"
              placeholder="Name or phone"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              className="h-10 rounded-lg bg-card pl-9"
            />
          </div>
          <Button className="h-10 gap-1.5 rounded-lg" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Add booking
          </Button>
        </div>
      </div>

      {chips.length > 1 && (
        <div role="group" aria-label="Filter by outcome" className="flex flex-wrap gap-2">
          {chips.map((c) => {
            const on = outcome === c.value;
            return (
              <button
                key={c.value}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setOutcome(on ? null : c.value);
                  setPage(0);
                }}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  on ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-foreground hover:bg-muted",
                )}
              >
                <StatusPill status={c.status} className="px-1.5">{c.label}</StatusPill>
                <span className="tabular-nums text-muted-foreground">{counts.get(c.value)}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
        {loading ? (
          <div className="space-y-px">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-4">
                <Skeleton className="h-9 w-9 rounded-full" />
                <Skeleton className="h-4 w-40" />
              </div>
            ))}
          </div>
        ) : unmapped ? (
          <Empty>GoHighLevel isn't connected for this account yet. Appointments will appear here once it is.</Empty>
        ) : appointments.length === 0 ? (
          <Empty>No appointments were booked in this period.</Empty>
        ) : filtered.length === 0 ? (
          <Empty>No appointments match.</Empty>
        ) : (
          <>
            {/* Phones: one tappable row per appointment; details in the dialog. */}
            <ul className="divide-y divide-border md:hidden">
              {rows.map((a) => {
                const meta = apptStatusMeta(a.appointment_status);
                return (
                  <li key={a.ghl_contact_id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(a.ghl_contact_id)}
                      className="flex min-h-[60px] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none"
                    >
                      <Avatar name={a.contact_name} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium text-foreground">{a.contact_name ?? "Unnamed"}</span>
                        <span className="block text-[13px] text-muted-foreground">{day(a.created_on, "MMM d")}</span>
                      </span>
                      {meta ? (
                        <StatusPill status={meta.status}>{meta.label}</StatusPill>
                      ) : (
                        <span className="text-xs text-muted-foreground">Set outcome</span>
                      )}
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Desktop: the full table, outcome editable in place. */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th scope="col" className="px-5 py-3 font-medium">Contact</th>
                    <th scope="col" className="px-3 py-3 font-medium">Date</th>
                    <th scope="col" className="px-3 py-3 font-medium">From ad</th>
                    <th scope="col" className="w-[220px] px-5 py-3 font-medium">Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => {
                    const name = a.contact_name ?? "Unnamed";
                    return (
                      <tr key={a.ghl_contact_id} className="border-t border-border align-top">
                        <th scope="row" className="px-5 py-3.5 text-left font-normal">
                          <button
                            type="button"
                            onClick={() => setOpenId(a.ghl_contact_id)}
                            className="group flex items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <Avatar name={a.contact_name} />
                            <span>
                              <span className="block font-medium text-foreground group-hover:text-primary">{name}</span>
                              {a.contact_phone != null && (
                                <span className="block text-[13px] tabular-nums text-muted-foreground">{formatPhone(a.contact_phone)}</span>
                              )}
                            </span>
                          </button>
                        </th>
                        <td className="whitespace-nowrap px-3 py-3.5 pt-5 tabular-nums text-foreground">
                          {day(a.created_on, "MMM d, yyyy")}
                          {a.appointment_time && <span className="block text-[13px] text-muted-foreground">{a.appointment_time}</span>}
                        </td>
                        <td className="max-w-[260px] px-3 py-3.5 pt-5 text-muted-foreground">
                          <span className="line-clamp-2">{a["Ad Name"] ?? "Not passed by the funnel"}</span>
                        </td>
                        <td className="space-y-1.5 px-5 py-3.5">
                          <OutcomeSelect
                            value={a.appointment_status}
                            onChange={(s) => edit.saveOutcome(a.ghl_contact_id, s)}
                            contactName={name}
                          />
                          {a.appointment_status === "sold" && (
                            <DealValueField
                              saved={a.deal_value}
                              onSave={(v) => edit.saveDealValue(a.ghl_contact_id, v)}
                              contactName={name}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {pages > 1 && (
              <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3 text-[13px] text-muted-foreground">
                <span className="tabular-nums">
                  {current * PER_PAGE + 1}–{Math.min((current + 1) * PER_PAGE, filtered.length)} of {filtered.length}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="rounded-lg" disabled={current === 0} onClick={() => setPage(current - 1)}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-lg" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <AppointmentDialog
        appt={open}
        onClose={() => setOpenId(null)}
        onOutcome={edit.saveOutcome}
        onDealValue={edit.saveDealValue}
        onDate={edit.saveDate}
      />
      <AddBookingDialog
        open={adding}
        onOpenChange={setAdding}
        leads={leads}
        pending={edit.addBooking.isPending}
        onSubmit={(form, done) => edit.addBooking.mutate(form, { onSuccess: done })}
      />
    </section>
  );
}

function Avatar({ name }: { name: string | null }) {
  return (
    <span
      aria-hidden
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-[13px] font-semibold text-muted-foreground"
    >
      {initials(name)}
    </span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-10 text-center text-sm text-muted-foreground">{children}</p>;
}
