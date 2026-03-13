import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, UserCircle2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface POC {
  id: string;
  name: string;
  email: string;
}

interface CustomerPOCPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountName: string;
}

export function CustomerPOCPanel({ open, onOpenChange, accountId, accountName }: CustomerPOCPanelProps) {
  const [pocs, setPocs] = useState<POC[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (open && accountId) fetchPOCs();
  }, [open, accountId]);

  const fetchPOCs = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("account_poc")
      .select("id, name, email")
      .eq("account_id", accountId)
      .order("created_at", { ascending: true });
    if (!error && data) setPocs(data);
    setLoading(false);
  };

  const handleAdd = async () => {
    const trimName = name.trim();
    const trimEmail = email.trim();
    if (!trimName || !trimEmail) return;
    setSaving(true);
    const { data, error } = await (supabase as any)
      .from("account_poc")
      .insert({ account_id: accountId, name: trimName, email: trimEmail })
      .select("id, name, email")
      .single();
    if (error) {
      toast.error("Failed to add contact");
    } else {
      setPocs((prev) => [...prev, data]);
      setName("");
      setEmail("");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error } = await (supabase as any)
      .from("account_poc")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Failed to remove contact");
    } else {
      setPocs((prev) => prev.filter((p) => p.id !== id));
    }
    setDeletingId(null);
  };

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const canAdd = name.trim().length > 0 && isValidEmail(email.trim());

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border/50">
          <SheetHeader className="space-y-1">
            <SheetTitle className="text-[17px] font-bold">Customer POC</SheetTitle>
            <SheetDescription className="text-[13px]">
              Points of contact for <span className="font-medium text-foreground">{accountName}</span>
            </SheetDescription>
          </SheetHeader>
        </div>

        {/* POC list */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : pocs.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center gap-2">
              <UserCircle2 className="w-9 h-9 text-muted-foreground/40" />
              <p className="text-[13px] text-muted-foreground">No points of contact added yet.</p>
            </div>
          ) : (
            pocs.map((poc) => (
              <div
                key={poc.id}
                className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-border/60 bg-card"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-[12px] font-bold text-primary">
                    {poc.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-foreground truncate">{poc.name}</p>
                  <p className="text-[12px] text-muted-foreground truncate">{poc.email}</p>
                </div>
                <button
                  onClick={() => handleDelete(poc.id)}
                  disabled={deletingId === poc.id}
                  className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  {deletingId === poc.id
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add form */}
        <div className="px-6 py-5 border-t border-border/50 space-y-3 bg-muted/30">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Add Point of Contact</p>
          <div className="space-y-2">
            <div>
              <Label htmlFor="poc-name" className="text-[12px] text-muted-foreground mb-1 block">Name</Label>
              <Input
                id="poc-name"
                placeholder="Jane Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 rounded-xl text-[13px]"
                onKeyDown={(e) => e.key === "Enter" && canAdd && !saving && handleAdd()}
              />
            </div>
            <div>
              <Label htmlFor="poc-email" className="text-[12px] text-muted-foreground mb-1 block">Email</Label>
              <Input
                id="poc-email"
                type="email"
                placeholder="jane@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-9 rounded-xl text-[13px]"
                onKeyDown={(e) => e.key === "Enter" && canAdd && !saving && handleAdd()}
              />
            </div>
          </div>
          <Button
            onClick={handleAdd}
            disabled={!canAdd || saving}
            className="w-full h-9 rounded-xl text-[13px] font-semibold"
          >
            {saving
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <><Plus className="w-4 h-4" /> Add POC</>}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
