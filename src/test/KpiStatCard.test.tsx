import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DollarSign } from "lucide-react";
import { KpiStatCard } from "@/components/dashboard/KpiStatCard";

describe("KpiStatCard", () => {
  it("renders the value when the feed is live", () => {
    render(<KpiStatCard label="GHL Leads" value="42" icon={DollarSign} />);
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });

  it("shows a dash and the reason instead of a misleading 0 when the feed is down", () => {
    render(
      <KpiStatCard
        label="Spend"
        value="$0.00"
        icon={DollarSign}
        unavailable
        unavailableReason="Meta Ads disconnected"
      />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("$0.00")).not.toBeInTheDocument();
    expect(screen.getByText("Meta Ads disconnected")).toBeInTheDocument();
  });

  it("does not make an unavailable tile clickable", () => {
    const onClick = vi.fn();
    render(
      <KpiStatCard label="Spend" value="$0.00" icon={DollarSign} unavailable onClick={onClick} />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("exposes a live selectable tile as a keyboard-reachable button", () => {
    const onClick = vi.fn();
    render(<KpiStatCard label="GHL Leads" value="42" icon={DollarSign} onClick={onClick} isActive />);
    const button = screen.getByRole("button", { name: /GHL Leads/ });
    expect(button).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
