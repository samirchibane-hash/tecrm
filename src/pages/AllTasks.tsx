import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TaskList } from "@/components/dashboard/TaskList";
import { PageHeader } from "@/components/layout/PageHeader";
import { useSettings } from "@/hooks/useSettings";

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
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <PageHeader
        title="Tasks"
        description="Every task across all accounts — filter by status, assignee, or category"
      />

      <TaskList
        accounts={dbAccounts}
        changeLogOptions={settings.change_log_options}
        defaultFilter="all"
      />
    </div>
  );
}
