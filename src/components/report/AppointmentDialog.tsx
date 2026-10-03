import { useEffect, useState } from "react";
import { CalendarDays, Clock, Mail, MapPin, Megaphone, Phone } from "lucide-react";
import { formatPhone } from "@/lib/format";
import { StatusPill } from "@/components/StatusPill";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DealValueField, OutcomeSelect } from "./AppointmentControls";
import type { ApptStatus } from "./reportConfig";
import type { GhlRow } from "./useAppointmentEditing";

function Row({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5 text-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function AppointmentDialog({
  appt,
  onClose,
  onOutcome,
  onDealValue,
  onDate,
}: {
  appt: GhlRow | null;
  onClose: () => void;
  onOutcome: (id: string, status: ApptStatus | "") => void;
  onDealValue: (id: string, value: number | null) => void;
  onDate: (id: string, createdOn: string) => void;
}) {
  const [date, setDate] = useState(appt?.created_on ?? "");
  useEffect(() => setDate(appt?.created_on ?? ""), [appt?.created_on]);

  if (!appt) return null;
  const name = appt.contact_name ?? "Contact";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-md"
        // Land on the dialog itself, not the date field: focusing an input
        // would select its text and, on phones, raise the keyboard.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).focus();
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-xl">{name}</DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            {appt.type && <StatusPill status="neutral" className="capitalize">{appt.type}</StatusPill>}
            <span>From GoHighLevel</span>
          </DialogDescription>
        </DialogHeader>

        <div className="divide-y divide-border rounded-xl border border-border px-4">
          {appt.contact_phone != null && (
            <Row icon={Phone}>
              <a href={`tel:${appt.contact_phone}`} className="text-primary hover:underline">{formatPhone(appt.contact_phone)}</a>
            </Row>
          )}
          {appt.contact_email && (
            <Row icon={Mail}>
              <a href={`mailto:${appt.contact_email}`} className="block truncate text-primary hover:underline">{appt.contact_email}</a>
            </Row>
          )}
          {appt.contact_address && <Row icon={MapPin}>{appt.contact_address}</Row>}
          <Row icon={CalendarDays}>
            <label className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                onBlur={() => date && date !== appt.created_on && onDate(appt.ghl_contact_id, date)}
                className="h-9 rounded-lg border border-input bg-card px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
          </Row>
          {appt.appointment_time && <Row icon={Clock}>{appt.appointment_time}</Row>}
          {appt["Ad Name"] && (
            <Row icon={Megaphone}>
              <span className="text-muted-foreground">From ad </span>
              {appt["Ad Name"]}
            </Row>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Outcome</p>
          <OutcomeSelect
            value={appt.appointment_status}
            onChange={(s) => onOutcome(appt.ghl_contact_id, s)}
            contactName={name}
          />
          {appt.appointment_status === "sold" && (
            <DealValueField saved={appt.deal_value} onSave={(v) => onDealValue(appt.ghl_contact_id, v)} contactName={name} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
