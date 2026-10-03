import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSupabase } from "@/integrations/supabase/SupabaseContext";
import type { Tables } from "@/integrations/supabase/types";
import type { ApptStatus } from "./reportConfig";

export type GhlRow = Tables<"ghl_conversions">;

export type BookingForm = {
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  contact_address: string;
  created_on: string;
  appointment_time: string;
};

function useRowUpdate(accountId: string, label: string) {
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<GhlRow> }) => {
      const { error } = await supabase.from("ghl_conversions").update(patch).eq("ghl_contact_id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ghl-conversions", accountId] });
      toast.success(`${label} saved`);
    },
    onError: () => toast.error(`Couldn't save ${label.toLowerCase()}`),
  });
}

/**
 * Every write the report makes to `ghl_conversions`. Runs through the report's
 * scoped client (useSupabase), so the report_* RLS policies apply.
 */
export function useAppointmentEditing(accountId: string) {
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  const outcome = useRowUpdate(accountId, "Outcome");
  const dealValue = useRowUpdate(accountId, "Deal value");
  const date = useRowUpdate(accountId, "Date");
  const addBooking = useMutation({
    mutationFn: async (form: BookingForm) => {
      const { error } = await supabase.from("ghl_conversions").insert({
        ghl_contact_id: crypto.randomUUID(),
        tecrm_id: accountId || null,
        contact_name: form.contact_name.trim(),
        contact_phone: form.contact_phone ? Number(form.contact_phone.replace(/\D/g, "")) : null,
        contact_email: form.contact_email.trim() || null,
        contact_address: form.contact_address.trim() || null,
        created_on: form.created_on,
        appointment_time: form.appointment_time || null,
        type: "water test",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ghl-conversions", accountId] });
      toast.success("Booking added");
    },
    onError: () => toast.error("Couldn't add the booking"),
  });

  return {
    saveOutcome: (id: string, status: ApptStatus | "") =>
      outcome.mutate({ id, patch: { appointment_status: status || null } }),
    saveDealValue: (id: string, value: number | null) => dealValue.mutate({ id, patch: { deal_value: value } }),
    saveDate: (id: string, createdOn: string) => date.mutate({ id, patch: { created_on: createdOn } }),
    addBooking,
  };
}
