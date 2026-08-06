import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TaskList } from "@/components/dashboard/TaskList";
import { useSettings } from "@/hooks/useSettings";
import { Button } from "@/components/ui/button";

export default function AllTasks() {
  const { settings } = useSettings();

  // Account names feed the "Account" pickers inside the new/detail task sheets.
  const { data: dbAccounts = [] } = useQuery({
    queryKey: ["all-accounts"],
    queryFn: async () => {
      const { data } = await supabase.from("accounts").select("id, account_name");
      return data ?? [];
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:py-10 sm:px-6 lg:px-8">

        {/* Page header */}
        <div className="mb-8 flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/" aria-label="Back to dashboard"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">All Tasks</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Every task across all accounts — filter by status, assignee, or category
            </p>
          </div>
        </div>

        <TaskList
          accounts={dbAccounts}
          changeLogOptions={settings.change_log_options}
          defaultFilter="all"
        />
      </div>
    </div>
  );
}
