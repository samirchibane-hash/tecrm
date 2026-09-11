import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ALL_KPIS, type KpiKey } from "@/components/dashboard/AccountCard";
import { useSettings } from "@/hooks/useSettings";
import { toast } from "sonner";

export function KpiSettings() {
  const { settings, updateSettings } = useSettings();

  const toggle = (key: KpiKey) => {
    const next = settings.enabled_kpis.includes(key)
      ? settings.enabled_kpis.filter((k) => k !== key)
      : [...settings.enabled_kpis, key];
    const cleanedVisible = settings.visible_kpis.filter((k) => next.includes(k));
    updateSettings({ enabled_kpis: next, visible_kpis: cleanedVisible });
  };

  const enableAll = () => {
    updateSettings({ enabled_kpis: ALL_KPIS.map((k) => k.key) });
    toast.success("All KPIs enabled");
  };

  const disableAll = () => {
    updateSettings({ enabled_kpis: [], visible_kpis: [] });
    toast.success("All KPIs disabled");
  };

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Disabled KPIs won't appear in the KPI selector on the dashboard.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={enableAll}>Enable All</Button>
            <Button variant="outline" size="sm" onClick={disableAll}>Disable All</Button>
          </div>
        </div>
        <div className="space-y-2">
          {ALL_KPIS.map(({ key, label, icon: Icon }) => (
            <div key={key} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex items-center gap-3">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor={`setting-${key}`} className="cursor-pointer font-medium">{label}</Label>
              </div>
              <Switch
                id={`setting-${key}`}
                checked={settings.enabled_kpis.includes(key)}
                onCheckedChange={() => toggle(key)}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
