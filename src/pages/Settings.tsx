import { Link, Navigate, useParams } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { useSidebar } from "@/components/ui/sidebar";
import { PageHeader } from "@/components/layout/PageHeader";
import { SETTINGS_SECTIONS, type SettingsSlug } from "@/components/layout/navigation";
import { KpiSettings } from "@/components/settings/KpiSettings";
import { AccountVisibilitySettings } from "@/components/settings/AccountVisibilitySettings";
import { ClientFeatureSettings } from "@/components/settings/ClientFeatureSettings";
import { TeamSettings } from "@/components/settings/TeamSettings";
import { ChangeLogSettings } from "@/components/settings/ChangeLogSettings";
import { OnboardingChecklistSettings } from "@/components/settings/OnboardingChecklistSettings";
import { IntegrationsSettings } from "@/components/settings/IntegrationsSettings";
import { useSettings } from "@/hooks/useSettings";
import { cn } from "@/lib/utils";

const SECTION_COMPONENTS: Record<SettingsSlug, React.ComponentType> = {
  kpis: KpiSettings,
  accounts: AccountVisibilitySettings,
  features: ClientFeatureSettings,
  team: TeamSettings,
  "change-log": ChangeLogSettings,
  onboarding: OnboardingChecklistSettings,
  integrations: IntegrationsSettings,
};

// Sections that edit the global settings row need it loaded before rendering,
// or their optimistic writes would merge into defaults.
const NEEDS_SETTINGS_ROW: SettingsSlug[] = ["kpis", "accounts", "change-log", "onboarding"];

const Settings = () => {
  const { section: slug } = useParams();
  const { isLoading } = useSettings();
  const { state, isMobile } = useSidebar();
  const section = SETTINGS_SECTIONS.find((s) => s.slug === slug);

  if (!section) return <Navigate to={`/settings/${SETTINGS_SECTIONS[0].slug}`} replace />;

  const Section = SECTION_COMPONENTS[section.slug];
  // The sidebar lists these sub-pages when expanded; when it's collapsed to
  // icons (or a sheet on phones) the page carries its own switcher.
  const showInlineNav = isMobile || state === "collapsed";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Settings</p>
      <PageHeader title={section.title} description={section.description} />

      {showInlineNav && (
        <nav aria-label="Settings sections" className="-mt-4 mb-6 overflow-x-auto">
          <ul className="flex w-max gap-1 rounded-lg border border-border bg-muted p-1">
            {SETTINGS_SECTIONS.map((s) => (
              <li key={s.slug}>
                <Link
                  to={`/settings/${s.slug}`}
                  aria-current={s.slug === section.slug ? "page" : undefined}
                  className={cn(
                    "block whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    s.slug === section.slug
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {isLoading && NEEDS_SETTINGS_ROW.includes(section.slug) ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : (
        <Section />
      )}
    </div>
  );
};

export default Settings;
