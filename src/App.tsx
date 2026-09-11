import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import AccountDetail from "./pages/AccountDetail";
import Creatives from "./pages/Creatives";
import AllTasks from "./pages/AllTasks";
import Revenue from "./pages/Revenue";
import ClaudeLog from "./pages/ClaudeLog";
import Settings from "./pages/Settings";
import ClientReport from "./pages/ClientReport";
import CallCenterReport from "./pages/CallCenterReport";
import ClientOnboarding from "./pages/ClientOnboarding";
import NotFound from "./pages/NotFound";
import { AuthGate } from "./components/AuthGate";
import { AppShell } from "./components/layout/AppShell";
import { SETTINGS_SECTIONS } from "./components/layout/navigation";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public — client-facing report links, scoped by an unguessable per-account token */}
          <Route path="/report/:token" element={<ClientReport />} />
          <Route path="/cc-report/:token" element={<CallCenterReport />} />

          {/* Admin — Supabase Auth session on the admin allowlist */}
          <Route element={<AuthGate />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<Index />} />
              <Route path="/account/:accountName" element={<AccountDetail />} />
              <Route path="/tasks" element={<AllTasks />} />
              <Route path="/creatives" element={<Creatives />} />
              <Route path="/revenue" element={<Revenue />} />
              <Route path="/claude-log" element={<ClaudeLog />} />
              <Route path="/settings" element={<Navigate to={`/settings/${SETTINGS_SECTIONS[0].slug}`} replace />} />
              <Route path="/settings/:section" element={<Settings />} />
              <Route path="/onboarding/:clientId" element={<ClientOnboarding />} />
            </Route>
          </Route>

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
