import { useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AccountHeader } from "@/components/account/AccountHeader";
import { AccountKpiSection } from "@/components/account/AccountKpiSection";
import { AccountTargetsPopover } from "@/components/account/AccountTargetsPopover";
import { AccountTasksCard } from "@/components/account/AccountTasksCard";
import { ClientProfileTab } from "@/components/account/ClientProfileTab";
import { CreativeBriefsList, CreativeTemplatesGrid } from "@/components/account/CreativeProduction";
import { DriveFolderCard } from "@/components/account/DriveFolder";
import { PointsOfContactCard } from "@/components/account/PointsOfContactCard";
import { useAccount, useAccountBriefs, useAccountTasks, useCreativeTemplates } from "@/components/account/queries";
import { AccountWorkLog } from "@/components/claude-log/AccountWorkLog";
import { CreativeIntelligence } from "@/components/creative-performance/CreativeIntelligence";
import { FunnelTab } from "@/components/funnel/FunnelTab";
import { ACCOUNT_PERIODS, presetDateRange, type MetaPreset } from "@/lib/periods";

const TABS = ["performance", "funnel", "briefs", "operations", "client-profile"] as const;
type Tab = (typeof TABS)[number];
const DEFAULT_PERIOD: MetaPreset = "last_30d";

const Count = ({ n }: { n: number }) =>
  n > 0 ? <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{n}</span> : null;

/**
 * A client's account: Performance (results + creative intelligence), Funnel
 * (step conversion + landing page tests), Briefs, Operations, and what they
 * told us at onboarding. The page composes; every section is its own component.
 */
const AccountDetail = () => {
  const { accountName } = useParams<{ accountName: string }>();
  const decodedName = decodeURIComponent(accountName ?? "");
  const [params, setParams] = useSearchParams();

  const tab: Tab = (TABS as readonly string[]).includes(params.get("tab") ?? "") ? (params.get("tab") as Tab) : "performance";
  const periodParam = params.get("period");
  const preset: MetaPreset = ACCOUNT_PERIODS.some((p) => p.value === periodParam) ? (periodParam as MetaPreset) : DEFAULT_PERIOD;
  const setParam = (key: string, value: string) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set(key, value);
      return next;
    }, { replace: true });

  const { data: account } = useAccount(decodedName);
  const accountId = account?.id ?? "";

  const { data: linkedClient } = useQuery({
    queryKey: ["linked-client", accountId],
    queryFn: async () => {
      if (!accountId) return null;
      const { data } = await supabase.from("clients").select("*").eq("account_id", accountId).maybeSingle();
      return data ?? null;
    },
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: tasks = [], refetch: refetchTasks } = useAccountTasks(decodedName);
  const { data: briefs = [] } = useAccountBriefs(decodedName);
  const templates = useCreativeTemplates(decodedName);
  const openTasks = tasks.filter((t) => !t.completed).length;

  const dateRange = useMemo(() => presetDateRange(preset), [preset]);
  const rangeCaption = dateRange?.from && dateRange.to
    ? `${format(dateRange.from, "MMM d")} – ${format(dateRange.to, "MMM d, yyyy")}`
    : "All time";
  const showPeriod = tab === "performance" || tab === "funnel";

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <AccountHeader accountName={decodedName} account={account} />

        <Tabs value={tab === "client-profile" && !linkedClient ? "performance" : tab} onValueChange={(v) => setParam("tab", v)}>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="max-w-full overflow-x-auto">
              <TabsList>
                <TabsTrigger value="performance">Performance</TabsTrigger>
                <TabsTrigger value="funnel">Funnel</TabsTrigger>
                <TabsTrigger value="briefs">Briefs<Count n={briefs.length} /></TabsTrigger>
                <TabsTrigger value="operations">Operations<Count n={openTasks} /></TabsTrigger>
                {linkedClient && <TabsTrigger value="client-profile">Client profile</TabsTrigger>}
              </TabsList>
            </div>
            {showPeriod && (
              <div className="flex flex-wrap items-center gap-2">
                <Select value={preset} onValueChange={(v) => setParam("period", v)}>
                  <SelectTrigger className="h-8 w-auto gap-1.5 text-xs" aria-label="Report period">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end">
                    {ACCOUNT_PERIODS.map((p) => <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {tab === "performance" && account && (
                  <AccountTargetsPopover accountId={account.id} accountName={decodedName} cpl={account.target_cpl} cpa={account.target_cpa} />
                )}
              </div>
            )}
          </div>

          <TabsContent value="performance" className="space-y-10">
            <AccountKpiSection
              accountId={accountId}
              accountName={decodedName}
              fbAdAccountId={account?.fb_ad_account_id}
              dateRange={dateRange}
              rangeCaption={rangeCaption}
              tasks={tasks}
              briefs={briefs}
            />
            <CreativeIntelligence
              accountId={accountId}
              accountName={decodedName}
              preset={preset}
              targets={{ cpl: account?.target_cpl ?? null, cpa: account?.target_cpa ?? null }}
            />
          </TabsContent>

          <TabsContent value="funnel">
            <FunnelTab accountId={accountId} accountName={decodedName} preset={preset} />
          </TabsContent>

          <TabsContent value="briefs" className="space-y-10">
            <CreativeBriefsList briefs={briefs} />
            <CreativeTemplatesGrid batches={templates} />
          </TabsContent>

          <TabsContent value="operations" className="space-y-6">
            <AccountTasksCard accountName={decodedName} tasks={tasks} onChange={() => refetchTasks()} />
            <AccountWorkLog accountId={accountId} />
            <div className="grid gap-6 lg:grid-cols-2">
              <PointsOfContactCard accountId={accountId} />
              <DriveFolderCard accountId={accountId} accountName={decodedName} url={account?.gdrive_folder_url ?? null} />
            </div>
          </TabsContent>

          {linkedClient && (
            <TabsContent value="client-profile">
              <ClientProfileTab client={linkedClient} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
};

export default AccountDetail;
