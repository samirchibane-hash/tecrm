import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./client";

// Components shared between the signed-in CRM and the public report pages read
// their Supabase client from here instead of importing the singleton, so the
// same code runs as the admin session or as one client's report token.

interface SupabaseScope {
  client: SupabaseClient<Database>;
  /** Stable key for react-query caches, so admin and report data never mix. */
  scope: string;
}

const SupabaseContext = createContext<SupabaseScope>({ client: supabase, scope: "admin" });

export function useSupabase(): SupabaseClient<Database> {
  return useContext(SupabaseContext).client;
}

export function useSupabaseScope(): string {
  return useContext(SupabaseContext).scope;
}

// A report page gets its own anonymous client that sends the report token on
// every request. RLS resolves the token to a single account (see
// report_account_id() in the migrations), so the page can only see — and only
// edit the outcome fields of — that one client's data.
export function ReportClientProvider({ token, children }: { token: string; children: ReactNode }) {
  const value = useMemo<SupabaseScope>(
    () => ({
      client: createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        global: { headers: { "x-report-token": token } },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          storageKey: `te-report-${token}`,
        },
      }),
      scope: `report:${token}`,
    }),
    [token]
  );
  return <SupabaseContext.Provider value={value}>{children}</SupabaseContext.Provider>;
}
