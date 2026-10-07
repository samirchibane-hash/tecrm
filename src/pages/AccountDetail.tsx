import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountHeader } from "@/components/account/AccountHeader";
import { AccountKpiSection } from "@/components/account/AccountKpiSection";
import { AccountTasksCard } from "@/components/account/AccountTasksCard";
import { ClientProfileTab } from "@/components/account/ClientProfileTab";
import { CreativeBriefsList, CreativeTemplatesGrid } from "@/components/account/CreativeProduction";
import { DriveFolderCard } from "@/components/account/DriveFolder";
import { PointsOfContactCard } from "@/components/account/PointsOfContactCard";
import { useAccount, useAccountBriefs, useAccountTasks, useCreativeTemplates } from "@/components/account/queries";
import { AccountWorkLog } from "@/components/claude-log/AccountWorkLog";
import { PortfolioCreativeGallery } from "@/components/creative-performance/PortfolioCreativeGallery";
import { DashboardPeriodPicker } from "@/components/dashboard/DashboardPeriodPicker";
import { FunnelsBoard } from "@/components/funnels/FunnelsBoard";
import { useAllAccounts } from "@/hooks/useAllAccounts";
import { useDashboardPeriod } from "@/hooks/useDashboardPeriod";

// "funnel" was its own tab until 2026-10-05; old links land on Performance,
// where the client's funnels now sit under its creatives.
const TABS = ["performance", "briefs", "operations", "client-profile"] as const;
type Tab = (typeof TABS)[number];

const Count = ({ n }: { n: number }) =>
  n > 0 ? <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{n}</span> : null;

/** A titled block of the Performance tab, with a way out to the same view across every client. */
function Section({ id, title, allHref, allLabel, children }: { id: string; title: string; allHref: string; allLabel: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id={id} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
        <Link
          to={allHref}
          className="group inline-flex items-center gap-1 rounded-sm text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {allLabel}
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </div>
      {children}
    </section>
  );
}

/**
 * A client's account: Performance (results, then the same funnel board as /funnels
 * and the same creative gallery as /creatives, scoped to this client),
 * Briefs, Operations, and what they told us at onboarding. The period is the
 * control every screen shares, so a range here means the same days as there.
 * The page composes; every section is its own component.
 */
const AccountDetail = () => {
  const { accountName } = useParams<{ accountName: string }>();
  const decodedName = decodeURIComponent(accountName ?? "");
  const [params, setParams] = useSearchParams();

  const tab: Tab = (TABS as readonly string[]).includes(params.get("tab") ?? "") ? (params.get("tab") as Tab) : "performance";
  const setParam = (key: string, value: string) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set(key, value);
      return next;
    }, { replace: true });

  const { data: account } = useAccount(decodedName);
  const { data: accounts = [] } = useAllAccounts();
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

  const { dateRange, label: periodLabel, creativeRange, onChange: onPeriodChange } = useDashboardPeriod();

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <AccountHeader accountName={decodedName} account={account} />

        <Tabs value={tab === "client-profile" && !linkedClient ? "performance" : tab} onValueChange={(v) => setParam("tab", v)}>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="max-w-full overflow-x-auto">
              <TabsList>
                <TabsTrigger value="performance">Performance</TabsTrigger>
                <TabsTrigger value="briefs">Briefs<Count n={briefs.length} /></TabsTrigger>
                <TabsTrigger value="operations">Operations<Count n={openTasks} /></TabsTrigger>
                {linkedClient && <TabsTrigger value="client-profile">Client profile</TabsTrigger>}
              </TabsList>
            </div>
            {tab === "performance" && (
              <div className="flex flex-wrap items-center gap-2">
                <DashboardPeriodPicker dateRange={dateRange} label={periodLabel} onChange={onPeriodChange} />
              </div>
            )}
          </div>

          <TabsContent value="performance" className="space-y-10">
            <AccountKpiSection
              accountId={accountId}
              accountName={decodedName}
              fbAdAccountId={account?.fb_ad_account_id}
              dateRange={dateRange}
              rangeCaption={periodLabel}
              tasks={tasks}
              briefs={briefs}
            />
            {accountId && (
              <>
                <Section id="funnels-heading" title="Funnels" allHref="/funnels" allLabel="All clients">
                  <FunnelsBoard
                    range={creativeRange}
                    periodCaption={periodLabel}
                    accounts={accounts}
                    hiddenAccounts={[]}
                    accountId={accountId}
                  />
                </Section>
                <Section id="creatives-heading" title="Creative performance" allHref="/creatives" allLabel="All clients">
                  <PortfolioCreativeGallery
                    range={creativeRange}
                    periodCaption={periodLabel}
                    accounts={accounts}
                    hiddenAccounts={[]}
                    accountId={accountId}
                  />
                </Section>
              </>
            )}
          </TabsContent>

          <TabsContent value="briefs" className="space-y-10">
            <CreativeBriefsList briefs={briefs} />
            <CreativeTemplatesGrid batches={templates} />
          </TabsContent>

          <TabsContent value="operations" className="space-y-6">
            <AccountTasksCard accountName={decodedName} tasks={tasks} onChange={() => refetchTasks()} />
            <AccountWorkLog accountId={accountId} accountName={decodedName} />
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
