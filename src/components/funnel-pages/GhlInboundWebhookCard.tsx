import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, Webhook } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { webhookUrlToStore } from "./ghlWebhookUrl";
import { useFunnelSites, type FunnelSiteRow } from "./useFunnelSites";

function WebhookField({ accountId, site, labelledByDomain }: { accountId: string; site: FunnelSiteRow; labelledByDomain: boolean }) {
  const queryClient = useQueryClient();
  const saved = site.ghl_inbound_webhook_url ?? "";
  const [value, setValue] = useState(saved);
  useEffect(() => setValue(saved), [saved]);

  const inputId = `ghl-webhook-${site.id}`;
  const label = labelledByDomain ? site.domain : "Inbound webhook URL";
  const dirty = value.trim() !== saved.trim();

  const save = useMutation({
    mutationFn: async () => {
      const next = webhookUrlToStore(value);
      const { error } = await supabase
        .from("funnel_sites")
        .update({ ghl_inbound_webhook_url: next })
        .eq("id", site.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funnel-sites", accountId] });
      toast.success("Webhook URL saved");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to save webhook URL"),
  });

  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId} className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={inputId}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && dirty && !save.isPending) save.mutate(); }}
          placeholder="https://services.leadconnectorhq.com/hooks/…"
          aria-label={labelledByDomain ? `GHL Import New Leads webhook for ${site.domain}` : undefined}
          spellCheck={false}
          autoComplete="off"
          className="h-8 font-mono text-xs"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-8 shrink-0 p-0"
          disabled={!value.trim()}
          aria-label={labelledByDomain ? `Copy webhook URL for ${site.domain}` : "Copy webhook URL"}
          onClick={() => {
            navigator.clipboard.writeText(value.trim());
            toast.success("Webhook URL copied");
          }}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-8 shrink-0"
          disabled={!dirty || save.isPending}
          aria-label={labelledByDomain ? `Save webhook URL for ${site.domain}` : "Save webhook URL"}
          onClick={() => save.mutate()}
        >
          {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
        </Button>
      </div>
    </div>
  );
}

/** The GHL workflow URL a funnel builder pastes into this client's landing page. */
export function GhlInboundWebhookCard({ accountId }: { accountId: string }) {
  const { data: sites, isLoading, isError } = useFunnelSites(accountId);
  const waiting = !accountId || isLoading;

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
          Inbound webhook from the GoHighLevel workflow that imports new leads from this funnel.
          {sites?.length === 1 && <> Stored with {sites[0].domain}.</>}
        </p>
        {waiting ? (
          <Skeleton className="h-8 rounded-md" />
        ) : isError || !sites ? (
          <p className="text-xs text-danger">Couldn't load the webhook URL.</p>
        ) : sites.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No funnels repo folder is linked to this client, so the webhook has nowhere to be stored yet.
          </p>
        ) : (
          sites.map((site) => (
            <WebhookField key={site.id} accountId={accountId} site={site} labelledByDomain={sites.length > 1} />
          ))
        )}
      </CardContent>
    </Card>
  );
}
