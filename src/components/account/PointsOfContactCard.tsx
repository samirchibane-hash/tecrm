import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, UserCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Poc = { id: string; name: string; email: string };

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/** Who at the client receives campaign updates. */
export function PointsOfContactCard({ accountId }: { accountId: string }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: pocs = [], isLoading } = useQuery({
    queryKey: ["account-poc", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase.from("account_poc").select("id, name, email").eq("account_id", accountId).order("created_at", { ascending: true });
      if (error) throw error;
      return data as Poc[];
    },
    enabled: !!accountId,
  });

  const canAdd = name.trim().length > 0 && isValidEmail(email.trim());

  const add = async () => {
    if (!canAdd || saving) return;
    setSaving(true);
    const { data, error } = await supabase.from("account_poc").insert({ account_id: accountId, name: name.trim(), email: email.trim() }).select("id, name, email").single();
    if (error) {
      toast.error("Failed to add contact");
    } else {
      queryClient.setQueryData<Poc[]>(["account-poc", accountId], (prev) => [...(prev ?? []), data as Poc]);
      setName("");
      setEmail("");
      toast.success("Contact added");
    }
    setSaving(false);
  };

  const remove = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from("account_poc").delete().eq("id", id);
    if (error) toast.error("Failed to remove contact");
    else queryClient.setQueryData<Poc[]>(["account-poc", accountId], (prev) => (prev ?? []).filter((p) => p.id !== id));
    setDeletingId(null);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <UserCircle2 className="h-4 w-4 text-muted-foreground" />
          Points of Contact
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : pocs.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">No contacts added yet.</p>
        ) : (
          <div className="space-y-2">
            {pocs.map((poc) => (
              <div key={poc.id} className="group flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <span className="text-xs font-bold text-primary">{poc.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{poc.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{poc.email}</p>
                </div>
                <button
                  onClick={() => remove(poc.id)}
                  disabled={deletingId === poc.id}
                  aria-label={`Remove ${poc.name}`}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
                >
                  {deletingId === poc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="space-y-3 border-t border-border/50 pt-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Add Contact</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <Label htmlFor="poc-name" className="mb-1 block text-xs text-muted-foreground">Name</Label>
              <Input id="poc-name" placeholder="Jane Smith" value={name} onChange={(e) => setName(e.target.value)} className="h-9 text-sm" onKeyDown={(e) => e.key === "Enter" && add()} />
            </div>
            <div>
              <Label htmlFor="poc-email" className="mb-1 block text-xs text-muted-foreground">Email</Label>
              <Input id="poc-email" type="email" placeholder="jane@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-9 text-sm" onKeyDown={(e) => e.key === "Enter" && add()} />
            </div>
          </div>
          <Button onClick={add} disabled={!canAdd || saving || !accountId} size="sm" className="gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Add Contact
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
