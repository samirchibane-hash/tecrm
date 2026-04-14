import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import AccountDetail from "./pages/AccountDetail";
import Creatives from "./pages/Creatives";
import CompetitorAnalysis from "./pages/CompetitorAnalysis";
import Settings from "./pages/Settings";
import ClientReport from "./pages/ClientReport";
import CallCenterReport from "./pages/CallCenterReport";
import NotFound from "./pages/NotFound";
import { PasscodeGate } from "./components/PasscodeGate";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public — client-facing report links */}
          <Route path="/report/:accountName" element={<ClientReport />} />
          <Route path="/cc-report/:accountName" element={<CallCenterReport />} />

          {/* Admin — passcode protected */}
          <Route path="/" element={<PasscodeGate><Index /></PasscodeGate>} />
          <Route path="/account/:accountName" element={<PasscodeGate><AccountDetail /></PasscodeGate>} />
          <Route path="/creatives" element={<PasscodeGate><Creatives /></PasscodeGate>} />
          <Route path="/competitor-analysis" element={<PasscodeGate><CompetitorAnalysis /></PasscodeGate>} />
          <Route path="/settings" element={<PasscodeGate><Settings /></PasscodeGate>} />

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
