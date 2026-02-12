import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ALL_KPIS, type KpiKey } from "@/components/dashboard/AccountCard";
import { toast } from "sonner";

const STORAGE_KEY = "dashboard-enabled-kpis";

export function getEnabledKpis(): KpiKey[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return ALL_KPIS.map((k) => k.key); // all enabled by default
}

const Settings = () => {
  const [enabledKpis, setEnabledKpis] = useState<KpiKey[]>(getEnabledKpis);

  const toggle = (key: KpiKey) => {
    setEnabledKpis((prev) => {
      const next = prev.includes(key)
        ? prev.filter((k) => k !== key)
        : [...prev, key];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));

      // also clean up visible-kpis so disabled ones get removed
      try {
        const visible = JSON.parse(localStorage.getItem("dashboard-visible-kpis") || "[]") as KpiKey[];
        const cleaned = visible.filter((k) => next.includes(k));
        localStorage.setItem("dashboard-visible-kpis", JSON.stringify(cleaned));
      } catch {}

      return next;
    });
  };

  const enableAll = () => {
    const all = ALL_KPIS.map((k) => k.key);
    setEnabledKpis(all);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    toast.success("All KPIs enabled");
  };

  const disableAll = () => {
    setEnabledKpis([]);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    localStorage.setItem("dashboard-visible-kpis", JSON.stringify([]));
    toast.success("All KPIs disabled");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <SettingsIcon className="h-6 w-6" /> Settings
            </h1>
            <p className="text-sm text-muted-foreground">Control which KPIs are available on the dashboard</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Dashboard KPIs</CardTitle>
                <CardDescription>
                  Toggle KPIs on or off. Disabled KPIs won't appear in the KPI selector on the dashboard.
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={enableAll}>Enable All</Button>
                <Button variant="outline" size="sm" onClick={disableAll}>Disable All</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {ALL_KPIS.map(({ key, label, icon: Icon }) => (
                <div key={key} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor={`setting-${key}`} className="cursor-pointer font-medium">{label}</Label>
                  </div>
                  <Switch
                    id={`setting-${key}`}
                    checked={enabledKpis.includes(key)}
                    onCheckedChange={() => toggle(key)}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
