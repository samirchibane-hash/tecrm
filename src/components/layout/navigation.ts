import {
  LayoutDashboard,
  Image as ImageIcon,
  Split,
  ListTodo,
  CircleDollarSign,
  GitCommitHorizontal,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  to: string;
  icon: LucideIcon;
  /** Extra path prefixes that belong to this section (drill-down pages). */
  alsoActiveOn?: string[];
};

// The primary menu, in the order it appears in the sidebar.
export const MAIN_NAV: NavItem[] = [
  { title: "Performance", to: "/", icon: LayoutDashboard, alsoActiveOn: ["/account/", "/onboarding/"] },
  { title: "Creatives", to: "/creatives", icon: ImageIcon },
  { title: "Funnels", to: "/funnels", icon: Split },
  { title: "Tasks", to: "/tasks", icon: ListTodo },
  { title: "Revenue", to: "/revenue", icon: CircleDollarSign },
  { title: "Claude Log", to: "/claude-log", icon: GitCommitHorizontal },
];

// Settings sub-pages. The slug is the URL segment: /settings/<slug>.
export const SETTINGS_SECTIONS = [
  { slug: "kpis", title: "Dashboard KPIs", description: "Which KPIs are available in the dashboard's KPI selector." },
  { slug: "accounts", title: "Account Visibility", description: "Hide client cards from the Performance dashboard." },
  { slug: "features", title: "Client Features", description: "VIP-only services, enabled per client." },
  { slug: "team", title: "Team Members", description: "People you can assign creative requests and tasks to." },
  { slug: "change-log", title: "Change Log Options", description: "Categories and sub-options for logging campaign changes." },
  { slug: "onboarding", title: "Onboarding Checklists", description: "The steps shown when onboarding a new client, per service." },
  { slug: "integrations", title: "Integrations", description: "GitHub and Stripe syncs, and how commits link to clients." },
] as const;

export type SettingsSlug = (typeof SETTINGS_SECTIONS)[number]["slug"];

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.to === "/") {
    return pathname === "/" || (item.alsoActiveOn ?? []).some((p) => pathname.startsWith(p));
  }
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}
