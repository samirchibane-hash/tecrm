import { Link as RouterLink, useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Phone, SquareArrowOutUpRight } from "lucide-react";
import { toast } from "sonner";
import { DriveHeaderButton } from "./DriveFolder";
import type { AccountRow } from "./queries";

const linkClass =
  "flex items-center gap-1.5 rounded-md border border-border/60 bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground";

export function AccountHeader({ accountName, account }: { accountName: string; account: AccountRow | undefined }) {
  const navigate = useNavigate();
  const adsManager = account?.fb_ad_account_id
    ? `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${account.fb_ad_account_id.replace(/^act_/, "")}`
    : null;

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={() => navigate("/")}
          aria-label="Back to Performance"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-card text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-foreground">{accountName}</h1>
          <div className="mt-0.5 flex items-center gap-1.5">
            <p className="text-xs text-muted-foreground">Client account</p>
            {account?.id && (
              <>
                <span className="text-xs text-muted-foreground/40">·</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(account.id); toast.success("TECRM ID copied"); }}
                  className="flex items-center gap-1 font-mono text-xs text-muted-foreground/60 transition-colors hover:text-muted-foreground"
                  title="Copy TECRM ID"
                >
                  {account.id.slice(0, 8)}…
                  <Copy className="h-2.5 w-2.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {adsManager && (
          <a href={adsManager} target="_blank" rel="noopener noreferrer" className={linkClass}>
            <SquareArrowOutUpRight className="h-3.5 w-3.5" />
            Ads Manager
          </a>
        )}
        {account && <DriveHeaderButton accountId={account.id} accountName={accountName} url={account.gdrive_folder_url} />}
        {account?.report_token && (
          <>
            <RouterLink to={`/report/${account.report_token}`} target="_blank" rel="noopener noreferrer" className={linkClass}>
              <SquareArrowOutUpRight className="h-3.5 w-3.5" />
              Client Report
            </RouterLink>
            <RouterLink to={`/cc-report/${account.report_token}`} target="_blank" rel="noopener noreferrer" className={linkClass}>
              <Phone className="h-3.5 w-3.5" />
              CC Report
            </RouterLink>
          </>
        )}
      </div>
    </div>
  );
}
