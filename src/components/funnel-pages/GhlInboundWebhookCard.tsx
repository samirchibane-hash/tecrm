import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Eye, EyeOff, Loader2, Webhook } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { webhookUrlToStore } from "./ghlWebhookUrl";
import { metaCredentialToStore } from "./metaCapiCredentials";
import { useFunnelSites, type FunnelSiteRow } from "./useFunnelSites";

type CredentialColumn = "ghl_inbound_webhook_url" | "meta_dataset_id" | "meta_access_token";

function credentialPatch(column: CredentialColumn, next: string | null) {
  switch (column) {
    case "ghl_inbound_webhook_url":
      return { ghl_inbound_webhook_url: next };
    case "meta_dataset_id":
      return { meta_dataset_id: next };
    case "meta_access_token":
      return { meta_access_token: next };
  }
}

function CredentialField({
  accountId,
  siteId,
  column,
  savedRaw,
  label,
  inputId,
  inputAriaLabel,
  placeholder,
  secret,
  toStore,
  copyLabel,
  copyToast,
  saveLabel,
  savedToast,
  failedToast,
  showLabel,
  hideLabel,
}: {
  accountId: string;
  siteId: string;
  column: CredentialColumn;
  savedRaw: string | null;
  label: string;
  inputId: string;
  inputAriaLabel?: string;
  placeholder: string;
  secret?: boolean;
  toStore: (raw: string) => string | null;
  copyLabel: string;
  copyToast: string;
  saveLabel: string;
  savedToast: string;
  failedToast: string;
  showLabel?: string;
  hideLabel?: string;
}) {
  const queryClient = useQueryClient();
  const saved = savedRaw ?? "";
  const [value, setValue] = useState(saved);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => setValue(saved), [saved]);

  const dirty = value.trim() !== saved.trim();

  const save = useMutation({
    mutationFn: async () => {
      const next = toStore(value);
      const { error } = await supabase
        .from("funnel_sites")
        .update(credentialPatch(column, next))
        .eq("id", siteId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funnel-sites", accountId] });
      toast.success(savedToast);
    },
    onError: (error: Error) => toast.error(error.message || failedToast),
  });

  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId} className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={inputId}
          type={secret && !revealed ? "password" : "text"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && dirty && !save.isPending) save.mutate(); }}
          placeholder={placeholder}
          aria-label={inputAriaLabel}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          className="h-8 font-mono text-xs"
        />
        {secret && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-8 shrink-0 p-0"
            aria-pressed={revealed}
            aria-label={revealed ? hideLabel : showLabel}
            onClick={() => setRevealed((open) => !open)}
          >
            {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-8 shrink-0 p-0"
          disabled={!value.trim()}
          aria-label={copyLabel}
          onClick={() => {
            navigator.clipboard.writeText(value.trim());
            toast.success(copyToast);
          }}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-8 shrink-0"
          disabled={!dirty || save.isPending}
          aria-label={saveLabel}
          onClick={() => save.mutate()}
        >
          {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
        </Button>
      </div>
    </div>
  );
}

function WebhookField({ accountId, site, labelledByDomain }: { accountId: string; site: FunnelSiteRow; labelledByDomain: boolean }) {
  const domain = labelledByDomain ? site.domain : null;
  return (
    <CredentialField
      accountId={accountId}
      siteId={site.id}
      column="ghl_inbound_webhook_url"
      savedRaw={site.ghl_inbound_webhook_url}
      label={domain ?? "Inbound webhook URL"}
      inputId={`ghl-webhook-${site.id}`}
      inputAriaLabel={domain ? `GHL Import New Leads webhook for ${domain}` : undefined}
      placeholder="https://services.leadconnectorhq.com/hooks/…"
      toStore={webhookUrlToStore}
      copyLabel={domain ? `Copy webhook URL for ${domain}` : "Copy webhook URL"}
      copyToast="Webhook URL copied"
      saveLabel={domain ? `Save webhook URL for ${domain}` : "Save webhook URL"}
      savedToast="Webhook URL saved"
      failedToast="Failed to save webhook URL"
    />
  );
}

function metaNames(base: string, domain: string | null) {
  const label = domain ? `${base} · ${domain}` : base;
  const forSite = domain ? ` for ${domain}` : "";
  return {
    label,
    copyLabel: `Copy ${base}${forSite}`,
    saveLabel: `Save ${base}${forSite}`,
    showLabel: `Show ${base}${forSite}`,
    hideLabel: `Hide ${base}${forSite}`,
  };
}

function MetaDatasetField({ accountId, site, labelledByDomain }: { accountId: string; site: FunnelSiteRow; labelledByDomain: boolean }) {
  const names = metaNames("Meta Dataset ID", labelledByDomain ? site.domain : null);
  return (
    <CredentialField
      accountId={accountId}
      siteId={site.id}
      column="meta_dataset_id"
      savedRaw={site.meta_dataset_id}
      label={names.label}
      inputId={`meta-dataset-${site.id}`}
      placeholder="Dataset or pixel ID"
      toStore={metaCredentialToStore}
      copyLabel={names.copyLabel}
      copyToast="Meta Dataset ID copied"
      saveLabel={names.saveLabel}
      savedToast="Meta Dataset ID saved"
      failedToast="Failed to save Meta Dataset ID"
    />
  );
}

function MetaTokenField({ accountId, site, labelledByDomain }: { accountId: string; site: FunnelSiteRow; labelledByDomain: boolean }) {
  const names = metaNames("Meta Access Token", labelledByDomain ? site.domain : null);
  return (
    <CredentialField
      accountId={accountId}
      siteId={site.id}
      column="meta_access_token"
      savedRaw={site.meta_access_token}
      label={names.label}
      inputId={`meta-token-${site.id}`}
      placeholder="Access token"
      secret
      toStore={metaCredentialToStore}
      copyLabel={names.copyLabel}
      copyToast="Meta access token copied"
      saveLabel={names.saveLabel}
      savedToast="Meta access token saved"
      failedToast="Failed to save Meta access token"
      showLabel={names.showLabel}
      hideLabel={names.hideLabel}
    />
  );
}

/** GHL inbound webhook and the Facebook CAPI values that workflow uses, per funnel site. */
export function GhlInboundWebhookCard({ accountId }: { accountId: string }) {
  const { data: sites, isLoading, isError } = useFunnelSites(accountId);
  const waiting = !accountId || isLoading;
  const labelledByDomain = (sites?.length ?? 0) > 1;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Webhook className="h-4 w-4 text-muted-foreground" />
          GHL Import New Leads webhook
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Inbound webhook from the GoHighLevel workflow that imports new leads from this funnel,
          plus the Meta Dataset ID and access token its Facebook CAPI steps use.
          {sites?.length === 1 && <> Stored with {sites[0].domain}.</>}
        </p>
        {waiting ? (
          <div className="space-y-3">
            <Skeleton className="h-8 rounded-md" />
            <Skeleton className="h-8 rounded-md" />
            <Skeleton className="h-8 rounded-md" />
          </div>
        ) : isError || !sites ? (
          <p className="text-xs text-danger">Couldn't load these funnel credentials.</p>
        ) : sites.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No funnels repo folder is linked to this client, so the webhook and Meta CAPI credentials have nowhere to be stored yet.
          </p>
        ) : (
          sites.map((site, index) => (
            <div key={site.id} className={index > 0 ? "space-y-3 border-t border-border pt-3" : "space-y-3"}>
              <WebhookField accountId={accountId} site={site} labelledByDomain={labelledByDomain} />
              <MetaDatasetField accountId={accountId} site={site} labelledByDomain={labelledByDomain} />
              <MetaTokenField accountId={accountId} site={site} labelledByDomain={labelledByDomain} />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
