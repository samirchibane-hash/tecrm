import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Settings as SettingsIcon, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ALL_KPIS, type KpiKey } from "@/components/dashboard/AccountCard";
import { useSettings } from "@/hooks/useSettings";
import { toast } from "sonner";

const Settings = () => {
  const { settings, isLoading, updateSettings } = useSettings();
  const [newCampaign, setNewCampaign] = useState("");

  const toggle = (key: KpiKey) => {
    const next = settings.enabled_kpis.includes(key)
      ? settings.enabled_kpis.filter((k) => k !== key)
      : [...settings.enabled_kpis, key];
    const cleanedVisible = settings.visible_kpis.filter((k) => next.includes(k));
    updateSettings({ enabled_kpis: next, visible_kpis: cleanedVisible });
  };

  const enableAll = () => {
    const all = ALL_KPIS.map((k) => k.key);
    updateSettings({ enabled_kpis: all });
    toast.success("All KPIs enabled");
  };

  const disableAll = () => {
    updateSettings({ enabled_kpis: [], visible_kpis: [] });
    toast.success("All KPIs disabled");
  };

  const addCampaign = () => {
    const name = newCampaign.trim();
    if (!name) return;
    if (settings.default_campaigns.includes(name)) {
      toast.error("Already exists");
      return;
    }
    updateSettings({ default_campaigns: [...settings.default_campaigns, name] });
    setNewCampaign("");
    toast.success(`Added "${name}"`);
  };

  const removeCampaign = (name: string) => {
    updateSettings({ default_campaigns: settings.default_campaigns.filter((c) => c !== name) });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8 space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    );
  }

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
                    checked={settings.enabled_kpis.includes(key)}
                    onCheckedChange={() => toggle(key)}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Default Campaign Options</CardTitle>
            <CardDescription>
              These options appear in the Change Log campaign dropdown for all client cards, in addition to campaigns from the data feed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="e.g. CRM, Retell Ai"
                value={newCampaign}
                onChange={(e) => setNewCampaign(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCampaign()}
                className="flex-1"
              />
              <Button size="sm" onClick={addCampaign} disabled={!newCampaign.trim()}>
                <Plus className="mr-1 h-4 w-4" /> Add
              </Button>
            </div>
            {settings.default_campaigns.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No default campaign options configured</p>
            )}
            <div className="flex flex-wrap gap-2">
              {settings.default_campaigns.map((name) => (
                <Badge key={name} variant="secondary" className="gap-1 pr-1 text-sm">
                  {name}
                  <button onClick={() => removeCampaign(name)} className="ml-1 rounded-full hover:bg-muted p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
