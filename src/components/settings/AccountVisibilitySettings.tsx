import { Eye, EyeOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useSettings } from "@/hooks/useSettings";
import { useAccountRows } from "./useAccountRows";

export function AccountVisibilitySettings() {
  const { settings, updateSettings } = useSettings();
  const { data: accountRows = [], isLoading } = useAccountRows();

  const toggleAccount = (name: string) => {
    const hidden = settings.hidden_accounts;
    const next = hidden.includes(name) ? hidden.filter((n) => n !== name) : [...hidden, name];
    updateSettings({ hidden_accounts: next });
  };

  return (
    <Card>
      <CardContent className="space-y-2 pt-6">
        {isLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
        {!isLoading && accountRows.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">No accounts found</p>
        )}
        {accountRows.map(({ id, account_name: name }) => {
          const isHidden = settings.hidden_accounts.includes(name);
          return (
            <div key={id} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex items-center gap-3">
                {isHidden ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
                <Label htmlFor={`visible-${id}`} className="cursor-pointer font-medium">{name}</Label>
              </div>
              <Switch id={`visible-${id}`} checked={!isHidden} onCheckedChange={() => toggleAccount(name)} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
