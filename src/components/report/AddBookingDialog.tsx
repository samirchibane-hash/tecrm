import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Search } from "lucide-react";
import { formatPhone } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BookingForm, GhlRow } from "./useAppointmentEditing";

const emptyForm = (): BookingForm => ({
  contact_name: "",
  contact_phone: "",
  contact_email: "",
  contact_address: "",
  created_on: format(new Date(), "yyyy-MM-dd"),
  appointment_time: "",
});

export function AddBookingDialog({
  open,
  onOpenChange,
  leads,
  onSubmit,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Every lead on the account, to prefill from. */
  leads: GhlRow[];
  onSubmit: (form: BookingForm, done: () => void) => void;
  pending: boolean;
}) {
  const [form, setForm] = useState<BookingForm>(emptyForm);
  const [search, setSearch] = useState("");
  const set = (k: keyof BookingForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return leads
      .filter((c) => c.contact_name?.toLowerCase().includes(q) || String(c.contact_phone ?? "").includes(q))
      .slice(0, 6);
  }, [search, leads]);

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      setForm(emptyForm());
      setSearch("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Add booking</DialogTitle>
          <DialogDescription>Start from an existing lead, or enter the details yourself.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden />
            <Input
              aria-label="Search existing leads"
              placeholder="Search leads by name or phone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 rounded-lg pl-9"
            />
          </div>
          {search.trim() && (matches.length > 0 ? (
            <ul className="max-h-44 divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {matches.map((lead) => (
                <li key={lead.ghl_contact_id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2.5 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                    onClick={() => {
                      setForm((f) => ({
                        ...f,
                        contact_name: lead.contact_name ?? "",
                        contact_phone: lead.contact_phone != null ? String(lead.contact_phone) : "",
                        contact_email: lead.contact_email ?? "",
                        contact_address: lead.contact_address ?? "",
                      }));
                      setSearch("");
                    }}
                  >
                    <span className="block text-sm font-medium text-foreground">{lead.contact_name ?? "Unnamed lead"}</span>
                    {lead.contact_phone != null && <span className="block text-xs text-muted-foreground">{formatPhone(lead.contact_phone)}</span>}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-1 text-xs text-muted-foreground">No matching leads. Fill in the details below.</p>
          ))}
        </div>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(form, () => close(false));
          }}
        >
          <fieldset className="space-y-3">
            <legend className="mb-1 text-sm font-medium text-foreground">Contact</legend>
            <div className="space-y-1.5">
              <Label htmlFor="bk-name">Full name</Label>
              <Input id="bk-name" required value={form.contact_name} onChange={set("contact_name")} className="h-10 rounded-lg" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="bk-phone">Phone</Label>
                <Input id="bk-phone" type="tel" value={form.contact_phone} onChange={set("contact_phone")} className="h-10 rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bk-email">Email</Label>
                <Input id="bk-email" type="email" value={form.contact_email} onChange={set("contact_email")} className="h-10 rounded-lg" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bk-address">Address</Label>
              <Input id="bk-address" value={form.contact_address} onChange={set("contact_address")} className="h-10 rounded-lg" />
            </div>
          </fieldset>
          <fieldset className="space-y-3">
            <legend className="mb-1 text-sm font-medium text-foreground">Appointment</legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="bk-date">Date</Label>
                <Input id="bk-date" type="date" required value={form.created_on} onChange={set("created_on")} className="h-10 rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bk-time">Time</Label>
                <Input id="bk-time" type="time" value={form.appointment_time} onChange={set("appointment_time")} className="h-10 rounded-lg" />
              </div>
            </div>
          </fieldset>
          <Button
            type="submit"
            className="h-11 w-full rounded-lg text-[15px]"
            disabled={!form.contact_name.trim() || !form.created_on || pending}
          >
            {pending ? "Adding…" : "Add booking"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
