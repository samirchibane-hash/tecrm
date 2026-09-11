import { format } from "date-fns";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Tables } from "@/integrations/supabase/types";
import { formatUsd } from "@/lib/format";

type Client = Tables<"clients">;
type Hours = Record<string, { open: string; close: string; status: string }>;

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function ProfileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</h3>
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-4">
      <span className="w-36 shrink-0 pt-0.5 text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

function LinkField({ label, href }: { label: string; href: string | null }) {
  if (!href) return null;
  return (
    <Field
      label={label}
      value={
        <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
          {href}
          <ExternalLink className="h-3 w-3" />
        </a>
      }
    />
  );
}

/** What the client told us at onboarding. */
export function ClientProfileTab({ client }: { client: Client }) {
  const c = client;
  const hours = c.business_hours as Hours | null;
  const brands = (c.brands as string[] | null) ?? [];
  const offers = (c.offers as string[] | null) ?? [];
  const amount = c.amount_paid ? formatUsd(c.amount_paid, { cents: true }) : null;

  return (
    <div className="space-y-5">
      <ProfileSection title="Business">
        <Field label="Business Name" value={c.business_name} />
        <Field label="Legal Name" value={c.legal_business_name} />
        <Field label="Business Type" value={c.business_type} />
        <Field label="EIN" value={c.ein} />
        <Field label="Location" value={c.city && c.state ? `${c.city}, ${c.state}` : null} />
        <Field label="Service Area" value={c.service_area} />
        <LinkField label="Website" href={c.website_url} />
        <Field label="Business Phone" value={c.business_phone} />
        <Field label="Business Email" value={c.business_email} />
      </ProfileSection>

      <ProfileSection title="Owner / Point of Contact">
        <Field label="Owner Name" value={c.owner_name} />
        <Field label="Owner Email" value={c.owner_email} />
        <Field label="Owner Cell" value={c.owner_cell} />
      </ProfileSection>

      <ProfileSection title="Service & Budget">
        <Field label="Service" value={c.service} />
        <Field label="Plan" value={c.plan} />
        <Field label="Ad Budget" value={c.ad_budget} />
        <Field label="Amount Paid" value={amount} />
        {brands.length > 0 && (
          <Field label="Brands" value={<span className="flex flex-wrap gap-1.5">{brands.map((b) => <Badge key={b} variant="secondary" className="text-xs">{b}</Badge>)}</span>} />
        )}
      </ProfileSection>

      {offers.length > 0 && (
        <ProfileSection title="Offers">
          <ul className="space-y-2">
            {offers.map((offer, i) => <li key={i} className="text-sm text-foreground">• {offer}</li>)}
          </ul>
        </ProfileSection>
      )}

      {hours && (
        <ProfileSection title="Business Hours">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {DAY_ORDER.map((day) => {
              const h = hours[day];
              if (!h) return null;
              return (
                <div key={day} className="flex items-center justify-between text-sm">
                  <span className="w-24 text-muted-foreground">{day}</span>
                  {h.status === "closed" ? <span className="text-xs italic text-muted-foreground">Closed</span> : <span className="font-medium">{h.open} – {h.close}</span>}
                </div>
              );
            })}
          </div>
        </ProfileSection>
      )}

      {c.additional_notes && (
        <ProfileSection title="Additional Notes">
          <p className="whitespace-pre-wrap text-sm text-foreground">{c.additional_notes}</p>
        </ProfileSection>
      )}

      <ProfileSection title="Social & Ads">
        <Field label="Has Facebook" value={c.has_facebook ? "Yes" : "No"} />
        <LinkField label="Facebook URL" href={c.facebook_url} />
      </ProfileSection>

      <div className="pt-1 text-xs text-muted-foreground">
        Submitted {c.submitted_at ? format(new Date(c.submitted_at), "MMM d, yyyy 'at' h:mm a") : "—"}
        {amount && <span className="ml-3 font-medium text-success">{amount}</span>}
      </div>
    </div>
  );
}
