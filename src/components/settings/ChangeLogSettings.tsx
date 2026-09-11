import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { getPalette } from "@/components/dashboard/AccountCard";
import { useSettings, type ChangeLogOption } from "@/hooks/useSettings";
import { toast } from "sonner";

export function ChangeLogSettings() {
  const { settings, updateSettings } = useSettings();
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newSubOption, setNewSubOption] = useState<Record<string, string>>({});
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const changeLogOptions: ChangeLogOption[] = settings.change_log_options ?? [];

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

  const addSubOption = (categoryLabel: string) => {
    const text = (newSubOption[categoryLabel] ?? "").trim();
    if (!text) return;
    const next = changeLogOptions.map((o) =>
      o.label === categoryLabel ? { ...o, sub_options: [...o.sub_options, text] } : o,
    );
    updateSettings({ change_log_options: next });
    setNewSubOption((prev) => ({ ...prev, [categoryLabel]: "" }));
  };

  const removeSubOption = (categoryLabel: string, sub: string) => {
    const next = changeLogOptions.map((o) =>
      o.label === categoryLabel ? { ...o, sub_options: o.sub_options.filter((s) => s !== sub) } : o,
    );
    updateSettings({ change_log_options: next });
  };

  const toggleExpanded = (label: string) => {
    setExpandedCategories((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <p className="text-sm text-muted-foreground">
          Add main categories (e.g. CRM) and sub-options (e.g. Automations, Landing Pages). They appear as a
          grouped dropdown when logging changes.
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="New category (e.g. CRM, Retell AI, Ads)"
            aria-label="New category"
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
          <p className="py-4 text-center text-sm text-muted-foreground">
            No categories configured yet. Add a category to get started.
          </p>
        )}

        <div className="space-y-2">
          {changeLogOptions.map((opt) => {
            const isExpanded = expandedCategories[opt.label] !== false;
            const pal = getPalette(opt.label, changeLogOptions);
            return (
              <Collapsible key={opt.label} open={isExpanded} onOpenChange={() => toggleExpanded(opt.label)}>
                <div className="rounded-lg border border-border">
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <CollapsibleTrigger asChild>
                      <button className={`flex items-center gap-2 text-sm font-medium transition-opacity hover:opacity-80 ${pal.label}`}>
                        <span className={`inline-block h-2.5 w-2.5 rounded-full ${pal.dot}`} />
                        {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        {opt.label}
                        <span className="text-xs font-normal text-muted-foreground">
                          ({opt.sub_options.length} sub-option{opt.sub_options.length !== 1 ? "s" : ""})
                        </span>
                      </button>
                    </CollapsibleTrigger>
                    <button
                      onClick={() => removeCategory(opt.label)}
                      className="p-0.5 text-muted-foreground transition-colors hover:text-destructive"
                      aria-label={`Remove ${opt.label}`}
                      title="Remove category"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <CollapsibleContent>
                    <div className="space-y-2 border-t border-border px-3 pb-3 pt-2">
                      {opt.sub_options.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {opt.sub_options.map((sub) => (
                            <Badge key={sub} variant="secondary" className={`gap-1 pr-1 text-xs ${pal.badge}`}>
                              <span className={`inline-block h-1.5 w-1.5 rounded-full ${pal.dot}`} />
                              {sub}
                              <button
                                onClick={() => removeSubOption(opt.label, sub)}
                                className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10"
                                aria-label={`Remove ${sub}`}
                              >
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add sub-option (e.g. Automations, Landing Pages)"
                          aria-label={`New sub-option for ${opt.label}`}
                          value={newSubOption[opt.label] ?? ""}
                          onChange={(e) => setNewSubOption((prev) => ({ ...prev, [opt.label]: e.target.value }))}
                          onKeyDown={(e) => e.key === "Enter" && addSubOption(opt.label)}
                          className="h-7 flex-1 text-xs"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2"
                          onClick={() => addSubOption(opt.label)}
                          disabled={!(newSubOption[opt.label] ?? "").trim()}
                          aria-label="Add sub-option"
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
  );
}
