import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Settings as SettingsIcon, Plus, X, Eye, EyeOff, ChevronDown, ChevronRight, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ALL_KPIS, getPalette, type KpiKey } from "@/components/dashboard/AccountCard";
import { useSettings, type ChangeLogOption } from "@/hooks/useSettings";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Settings = () => {
  const { settings, isLoading, updateSettings } = useSettings();
  const queryClient = useQueryClient();
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newSubOption, setNewSubOption] = useState<Record<string, string>>({});
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  // Full accounts list with IDs (needed for feature flag upserts)
  const { data: accountRows = [] } = useQuery({
    queryKey: ["accounts-list-full"],
    queryFn: async () => {
      const { data } = await supabase.from("accounts").select("id, account_name").order("account_name");
      return data ?? [];
    },
  });
  const accounts = accountRows.map((r) => r.account_name);

  // Account feature flags (call center enabled per account)
  const { data: featureRows = [] } = useQuery({
    queryKey: ["account-features-all"],
    queryFn: async () => {
      const { data } = await supabase.from("account_features").select("account_id, call_center_enabled");
      return data ?? [];
    },
  });

  const featureMap: Record<string, boolean> = Object.fromEntries(
    featureRows.map((r) => [r.account_id, r.call_center_enabled])
  );

  const toggleCallCenter = useMutation({
    mutationFn: async ({ accountId, enabled }: { accountId: string; enabled: boolean }) => {
      const { error } = await supabase.from("account_features").upsert(
        { account_id: accountId, call_center_enabled: enabled, updated_at: new Date().toISOString() },
        { onConflict: "account_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["account-features-all"] });
      queryClient.invalidateQueries({ queryKey: ["account-features"] });
    },
    onError: () => toast.error("Failed to update client features"),
  });

  const changeLogOptions: ChangeLogOption[] = settings.change_log_options ?? [];

  // KPI toggles
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

  // Account visibility
  const toggleAccount = (name: string) => {
    const hidden = settings.hidden_accounts;
    const next = hidden.includes(name)
      ? hidden.filter((n) => n !== name)
      : [...hidden, name];
    updateSettings({ hidden_accounts: next });
  };

  // Change Log Options — categories
  const addCategory = () => {
    const name = newCategoryName.trim();
    if (!name) return;
    if (changeLogOptions.some((o) => o.label === name)) {
      toast.error("Category already exists");
      return;
    }
    updateSettings({ change_log_options: [...changeLogOptions, { label: name, sub_options: [] }] });
    setNewCategoryName("");
    setExpandedCategories((prev) => ({ ...prev, [name]: true }));
    toast.success(`Added "${name}"`);
  };

  const removeCategory = (label: string) => {
    updateSettings({ change_log_options: changeLogOptions.filter((o) => o.label !== label) });
  };

  // Change Log Options — sub-options
  const addSubOption = (categoryLabel: string) => {
    const text = (newSubOption[categoryLabel] ?? "").trim();
    if (!text) return;
    const next = changeLogOptions.map((o) =>
      o.label === categoryLabel
        ? { ...o, sub_options: [...o.sub_options, text] }
        : o
    );
    updateSettings({ change_log_options: next });
    setNewSubOption((prev) => ({ ...prev, [categoryLabel]: "" }));
  };

  const removeSubOption = (categoryLabel: string, sub: string) => {
    const next = changeLogOptions.map((o) =>
      o.label === categoryLabel
        ? { ...o, sub_options: o.sub_options.filter((s) => s !== sub) }
        : o
    );
    updateSettings({ change_log_options: next });
  };

  const toggleExpanded = (label: string) => {
    setExpandedCategories((prev) => ({ ...prev, [label]: !prev[label] }));
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

        {/* KPI Settings */}
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

        {/* Change Log Options */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Change Log Options</CardTitle>
            <CardDescription>
              Organize campaigns and change types. Add main categories (e.g. CRM) and sub-options
              (e.g. Automations, Landing Pages). These appear as a grouped dropdown when logging changes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add new category */}
            <div className="flex gap-2">
              <Input
                placeholder="New category (e.g. CRM, Retell AI, Ads)"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCategory()}
                className="flex-1"
              />
              <Button size="sm" onClick={addCategory} disabled={!newCategoryName.trim()}>
                <Plus className="mr-1 h-4 w-4" /> Add
              </Button>
            </div>

            {changeLogOptions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No categories configured yet. Add a category to get started.
              </p>
            )}

            {/* Category list */}
            <div className="space-y-2">
              {changeLogOptions.map((opt) => {
                const isExpanded = expandedCategories[opt.label] !== false;
                const pal = getPalette(opt.label, changeLogOptions);
                return (
                  <Collapsible key={opt.label} open={isExpanded} onOpenChange={() => toggleExpanded(opt.label)}>
                    <div className="rounded-lg border border-border">
                      {/* Category header */}
                      <div className="flex items-center justify-between px-3 py-2.5">
                        <CollapsibleTrigger asChild>
                          <button className={`flex items-center gap-2 text-sm font-medium hover:opacity-80 transition-opacity ${pal.label}`}>
                            <span className={`inline-block h-2.5 w-2.5 rounded-full ${pal.dot}`} />
                            {isExpanded
                              ? <ChevronDown className="h-3.5 w-3.5" />
                              : <ChevronRight className="h-3.5 w-3.5" />
                            }
                            {opt.label}
                            <span className="text-xs text-muted-foreground font-normal">
                              ({opt.sub_options.length} sub-option{opt.sub_options.length !== 1 ? "s" : ""})
                            </span>
                          </button>
                        </CollapsibleTrigger>
                        <button
                          onClick={() => removeCategory(opt.label)}
                          className="text-muted-foreground hover:text-destructive transition-colors p-0.5"
                          title="Remove category"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <CollapsibleContent>
                        <div className="border-t border-border px-3 pb-3 pt-2 space-y-2">
                          {/* Existing sub-options */}
                          {opt.sub_options.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {opt.sub_options.map((sub) => (
                                <Badge key={sub} variant="secondary" className={`gap-1 pr-1 text-xs ${pal.badge}`}>
                                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${pal.dot}`} />
                                  {sub}
                                  <button
                                    onClick={() => removeSubOption(opt.label, sub)}
                                    className="ml-0.5 rounded-full hover:bg-black/10 p-0.5"
                                  >
                                    <X className="h-2.5 w-2.5" />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          )}

                          {/* Add sub-option */}
                          <div className="flex gap-2">
                            <Input
                              placeholder="Add sub-option (e.g. Automations, Landing Pages)"
                              value={newSubOption[opt.label] ?? ""}
                              onChange={(e) =>
                                setNewSubOption((prev) => ({ ...prev, [opt.label]: e.target.value }))
                              }
                              onKeyDown={(e) => e.key === "Enter" && addSubOption(opt.label)}
                              className="h-7 text-xs flex-1"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2"
                              onClick={() => addSubOption(opt.label)}
                              disabled={!(newSubOption[opt.label] ?? "").trim()}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Account Visibility */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Account Visibility</CardTitle>
            <CardDescription>
              Hide client cards from the dashboard. Hidden accounts won't appear on the main page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {accounts.map((name) => {
                const isHidden = settings.hidden_accounts.includes(name);
                return (
                  <div key={name} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div className="flex items-center gap-3">
                      {isHidden ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                      <Label className="cursor-pointer font-medium">{name}</Label>
                    </div>
                    <Switch
                      checked={!isHidden}
                      onCheckedChange={() => toggleAccount(name)}
                    />
                  </div>
                );
              })}
              {accounts.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No accounts found</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Client Features — VIP-only services toggled per account */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Phone className="h-4 w-4 text-sky-500" />
              Client Features
            </CardTitle>
            <CardDescription>
              Enable exclusive services per client. Call Center Dashboard is a VIP-only offering — only enable for clients who have this service active.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {accountRows.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No accounts found</p>
              )}
              {accountRows.map((row) => {
                const enabled = featureMap[row.id] ?? false;
                return (
                  <div key={row.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Phone className="h-4 w-4 text-sky-500 shrink-0" />
                      <div className="min-w-0">
                        <Label className="font-medium block truncate">{row.account_name}</Label>
                        <p className="text-xs text-muted-foreground">Call Center Dashboard</p>
                      </div>
                      {enabled && (
                        <Badge className="bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 text-[10px] px-1.5 py-0 shrink-0">
                          VIP
                        </Badge>
                      )}
                    </div>
                    <Switch
                      checked={enabled}
                      onCheckedChange={(val) =>
                        toggleCallCenter.mutate({ accountId: row.id, enabled: val })
                      }
                    />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default Settings;
