import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { GhlInboundWebhookCard } from "@/components/funnel-pages/GhlInboundWebhookCard";

const { select, update } = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table !== "funnel_sites") throw new Error(`unexpected table ${table}`);
      return { select, update };
    },
  },
}));

const DORANGE = "https://services.leadconnectorhq.com/hooks/GJvA4example/webhook-trigger/abc123";

function mockSites(rows: { id: string; root_dir: string; domain: string; ghl_inbound_webhook_url: string | null }[]) {
  const order = vi.fn().mockResolvedValue({ data: rows, error: null });
  const eq = vi.fn().mockReturnValue({ order });
  select.mockReturnValue({ eq });
  return { eq, order };
}

function renderCard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <GhlInboundWebhookCard accountId="acct-dorange" />
    </QueryClientProvider>,
  );
}

describe("GhlInboundWebhookCard", () => {
  beforeEach(() => {
    select.mockReset();
    update.mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it("loads the stored webhook and saves an edit back to funnel_sites", async () => {
    mockSites([{
      id: "site-1",
      root_dir: "dist/dorange",
      domain: "test.purifywithdorange.com",
      ghl_inbound_webhook_url: DORANGE,
    }]);
    const eq = vi.fn().mockResolvedValue({ error: null });
    update.mockReturnValue({ eq });

    renderCard();

    const input = await screen.findByLabelText("Inbound webhook URL");
    expect(input).toHaveValue(DORANGE);
    expect(screen.getByText(/test\.purifywithdorange\.com/)).toBeInTheDocument();
    expect(select).toHaveBeenCalledWith("id, root_dir, domain, ghl_inbound_webhook_url");

    const next = "https://services.leadconnectorhq.com/hooks/replaced";
    fireEvent.change(input, { target: { value: `  ${next}  ` } });
    fireEvent.click(screen.getByRole("button", { name: "Save webhook URL" }));

    await waitFor(() => expect(update).toHaveBeenCalledWith({ ghl_inbound_webhook_url: next }));
    expect(eq).toHaveBeenCalledWith("id", "site-1");
    expect(toast.success).toHaveBeenCalledWith("Webhook URL saved");
  });

  it("copies the webhook and clears it when the field is emptied", async () => {
    mockSites([{
      id: "site-1",
      root_dir: "dist/dorange",
      domain: "test.purifywithdorange.com",
      ghl_inbound_webhook_url: DORANGE,
    }]);
    const eq = vi.fn().mockResolvedValue({ error: null });
    update.mockReturnValue({ eq });

    renderCard();
    const input = await screen.findByLabelText("Inbound webhook URL");

    fireEvent.click(screen.getByRole("button", { name: "Copy webhook URL" }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(DORANGE);

    fireEvent.change(input, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save webhook URL" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith({ ghl_inbound_webhook_url: null }));
  });

  it("does not write a non-https value", async () => {
    mockSites([{
      id: "site-1",
      root_dir: "dist/dorange",
      domain: "test.purifywithdorange.com",
      ghl_inbound_webhook_url: null,
    }]);

    renderCard();
    const input = await screen.findByLabelText("Inbound webhook URL");
    fireEvent.change(input, { target: { value: "http://example.com/hook" } });
    fireEvent.click(screen.getByRole("button", { name: "Save webhook URL" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(update).not.toHaveBeenCalled();
  });

  it("says when the account has no funnel site to store a webhook on", async () => {
    mockSites([]);
    renderCard();
    expect(await screen.findByText(/nowhere to be stored/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save webhook URL" })).not.toBeInTheDocument();
  });
});
