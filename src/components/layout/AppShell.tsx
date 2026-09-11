import { Link, Outlet } from "react-router-dom";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";

// The sidebar writes its expanded/collapsed state to this cookie; read it back
// so a collapsed sidebar stays collapsed across reloads.
function initialSidebarOpen(): boolean {
  if (typeof document === "undefined") return true;
  return !document.cookie.split("; ").includes("sidebar:state=false");
}

/** Chrome for every internal (admin) route: left navigation + page content. */
export function AppShell() {
  return (
    <SidebarProvider defaultOpen={initialSidebarOpen()}>
      <AppSidebar />
      {/* min-w-0: wide tables scroll inside their cards instead of widening the page. */}
      <SidebarInset className="min-w-0">
        {/* Phones: the sidebar is a sheet, so the page needs its own way in. */}
        <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur md:hidden">
          <SidebarTrigger aria-label="Open menu" />
          <Link to="/" aria-label="Treat Engine — Performance" className="flex items-center">
            <img src="/Treat Engine Logo .png" alt="Treat Engine" className="h-6 w-auto dark:brightness-0 dark:invert" />
          </Link>
        </header>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
