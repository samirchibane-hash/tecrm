import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { useSettings, type ChecklistSection, ONBOARDING_SERVICES } from "@/hooks/useSettings";
import { toast } from "sonner";

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/, "").slice(0, 40);
}

function makeItemKey(label: string, existingKeys: Set<string>): string {
  const base = slugify(label) || "item";
  if (!existingKeys.has(base)) return base;
  let i = 2;
  while (existingKeys.has(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}

export function OnboardingChecklistSettings() {
  const { settings, updateSettings } = useSettings();
  const [checklistService, setChecklistService] = useState<string>("leads");
  const [newSectionName, setNewSectionName] = useState("");
  const [newItemText, setNewItemText] = useState<Record<string, string>>({});
  const [expandedChecklistSections, setExpandedChecklistSections] = useState<Record<string, boolean>>({});
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editingSectionValue, setEditingSectionValue] = useState("");

  const currentChecklist: ChecklistSection[] = settings.onboarding_checklists[checklistService] ?? [];

  const saveChecklist = (updated: ChecklistSection[]) => {
    updateSettings({
      onboarding_checklists: { ...settings.onboarding_checklists, [checklistService]: updated },
    });
  };

  const addChecklistSection = () => {
    const name = newSectionName.trim();
    if (!name) return;
    if (currentChecklist.some((s) => s.section === name)) {
      toast.error("Section already exists");
      return;
    }
    saveChecklist([...currentChecklist, { section: name, items: [] }]);
    setNewSectionName("");
    setExpandedChecklistSections((prev) => ({ ...prev, [`${checklistService}:${name}`]: true }));
    toast.success(`Added "${name}"`);
  };

  const removeChecklistSection = (sectionName: string) => {
    saveChecklist(currentChecklist.filter((s) => s.section !== sectionName));
  };

  const addChecklistItem = (sectionName: string) => {
    const label = (newItemText[`${checklistService}:${sectionName}`] ?? "").trim();
    if (!label) return;
    const allKeys = new Set(currentChecklist.flatMap((s) => s.items.map((i) => i.key)));
    const key = makeItemKey(label, allKeys);
    saveChecklist(
      currentChecklist.map((s) => (s.section === sectionName ? { ...s, items: [...s.items, { key, label }] } : s)),
    );
    setNewItemText((prev) => ({ ...prev, [`${checklistService}:${sectionName}`]: "" }));
  };

  const removeChecklistItem = (sectionName: string, itemKey: string) => {
    saveChecklist(
      currentChecklist.map((s) =>
        s.section === sectionName ? { ...s, items: s.items.filter((i) => i.key !== itemKey) } : s,
      ),
    );
  };

  const renameChecklistSection = (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) { setEditingSection(null); return; }
    if (currentChecklist.some((s) => s.section === trimmed)) {
      toast.error("A section with that name already exists");
      return;
    }
    saveChecklist(currentChecklist.map((s) => (s.section === oldName ? { ...s, section: trimmed } : s)));
    setExpandedChecklistSections((prev) => {
      const next = { ...prev };
      next[`${checklistService}:${trimmed}`] = prev[`${checklistService}:${oldName}`] ?? true;
      delete next[`${checklistService}:${oldName}`];
      return next;
    });
    setEditingSection(null);
  };

  const moveChecklistSection = (sectionName: string, dir: -1 | 1) => {
    const idx = currentChecklist.findIndex((s) => s.section === sectionName);
    if (idx < 0) return;
    const next = [...currentChecklist];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    saveChecklist(next);
  };

  const moveChecklistItem = (sectionName: string, itemKey: string, dir: -1 | 1) => {
    saveChecklist(
      currentChecklist.map((s) => {
        if (s.section !== sectionName) return s;
        const idx = s.items.findIndex((i) => i.key === itemKey);
        if (idx < 0) return s;
        const next = [...s.items];
        const swap = idx + dir;
        if (swap < 0 || swap >= next.length) return s;
        [next[idx], next[swap]] = [next[swap], next[idx]];
        return { ...s, items: next };
      }),
    );
  };

  const toggleChecklistSection = (sectionName: string) => {
    const k = `${checklistService}:${sectionName}`;
    setExpandedChecklistSections((prev) => ({ ...prev, [k]: !prev[k] }));
  };

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        {/* Service tabs */}
        <div className="flex w-fit gap-1 rounded-lg border border-border bg-muted p-1" role="tablist" aria-label="Service">
          {ONBOARDING_SERVICES.map((svc) => (
            <button
              key={svc}
              role="tab"
              aria-selected={checklistService === svc}
              onClick={() => setChecklistService(svc)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                checklistService === svc
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {svc}
            </button>
          ))}
        </div>

        {currentChecklist.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No sections yet. Add a section below to start building this checklist.
          </p>
        )}

        <div className="space-y-2">
          {currentChecklist.map((sec, secIdx) => {
            const sectionKey = `${checklistService}:${sec.section}`;
            const isExpanded = expandedChecklistSections[sectionKey] !== false;
            return (
              <Collapsible key={sectionKey} open={isExpanded} onOpenChange={() => toggleChecklistSection(sec.section)}>
                <div className="rounded-lg border border-border">
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <CollapsibleTrigger asChild>
                        <button
                          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                          aria-label={isExpanded ? `Collapse ${sec.section}` : `Expand ${sec.section}`}
                        >
                          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </button>
                      </CollapsibleTrigger>
                      {editingSection === sectionKey ? (
                        <input
                          autoFocus
                          aria-label="Section name"
                          value={editingSectionValue}
                          onChange={(e) => setEditingSectionValue(e.target.value)}
                          onBlur={() => renameChecklistSection(sec.section, editingSectionValue)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") renameChecklistSection(sec.section, editingSectionValue);
                            if (e.key === "Escape") setEditingSection(null);
                          }}
                          className="w-full border-b border-primary bg-transparent text-sm font-semibold uppercase tracking-wide outline-none"
                        />
                      ) : (
                        <button
                          onClick={() => { setEditingSection(sectionKey); setEditingSectionValue(sec.section); }}
                          className="truncate text-left text-sm font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
                          title="Click to rename"
                        >
                          {sec.section}
                        </button>
                      )}
                      <span className="shrink-0 text-xs font-normal normal-case text-muted-foreground">
                        ({sec.items.length} item{sec.items.length !== 1 ? "s" : ""})
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => moveChecklistSection(sec.section, -1)}
                        disabled={secIdx === 0}
                        className="p-0.5 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label="Move section up"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => moveChecklistSection(sec.section, 1)}
                        disabled={secIdx === currentChecklist.length - 1}
                        className="p-0.5 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label="Move section down"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => removeChecklistSection(sec.section)}
                        className="ml-1 p-0.5 text-muted-foreground transition-colors hover:text-destructive"
                        aria-label={`Remove section ${sec.section}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <CollapsibleContent>
                    <div className="space-y-2 border-t border-border px-3 pb-3 pt-2">
                      {sec.items.length > 0 && (
                        <div className="space-y-1">
                          {sec.items.map((item, itemIdx) => (
                            <div key={item.key} className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1.5">
                              <span className="text-sm text-foreground">{item.label}</span>
                              <div className="ml-2 flex shrink-0 items-center gap-0.5">
                                <button
                                  onClick={() => moveChecklistItem(sec.section, item.key, -1)}
                                  disabled={itemIdx === 0}
                                  className="p-0.5 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                                  aria-label="Move item up"
                                >
                                  <ArrowUp className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => moveChecklistItem(sec.section, item.key, 1)}
                                  disabled={itemIdx === sec.items.length - 1}
                                  className="p-0.5 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                                  aria-label="Move item down"
                                >
                                  <ArrowDown className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => removeChecklistItem(sec.section, item.key)}
                                  className="ml-0.5 p-0.5 text-muted-foreground transition-colors hover:text-destructive"
                                  aria-label={`Remove ${item.label}`}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Input
                          placeholder="New checklist item…"
                          aria-label={`New item in ${sec.section}`}
                          value={newItemText[sectionKey] ?? ""}
                          onChange={(e) => setNewItemText((prev) => ({ ...prev, [sectionKey]: e.target.value }))}
                          onKeyDown={(e) => e.key === "Enter" && addChecklistItem(sec.section)}
                          className="h-7 flex-1 text-xs"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2"
                          onClick={() => addChecklistItem(sec.section)}
                          disabled={!(newItemText[sectionKey] ?? "").trim()}
                          aria-label="Add item"
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

        <div className="flex gap-2">
          <Input
            placeholder="New section (e.g. Access & Setup, Launch)"
            aria-label="New section"
            value={newSectionName}
            onChange={(e) => setNewSectionName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addChecklistSection()}
            className="flex-1"
          />
          <Button size="sm" onClick={addChecklistSection} disabled={!newSectionName.trim()}>
            <Plus className="mr-1 h-4 w-4" /> Add Section
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
