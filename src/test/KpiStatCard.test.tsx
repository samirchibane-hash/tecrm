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

  it("renders no value while the query is in flight", () => {
    render(<KpiStatCard label="Leads" value="0" icon={DollarSign} loading onClick={vi.fn()} />);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.getByText("Loading")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("states the change in words, not colour alone", () => {
    render(
      <KpiStatCard
        label="Cost/Lead"
        value="$30.00"
        icon={DollarSign}
        change={{ direction: "down", text: "25%", tone: "success", spoken: "Down 25%" }}
        changeLabel="vs prior 30 days"
      />,
    );
    expect(screen.getByText("Down 25%")).toBeInTheDocument();
    expect(screen.getByText("vs prior 30 days")).toBeInTheDocument();
  });

  it("hides the change on an unavailable tile", () => {
    render(
      <KpiStatCard
        label="Spend"
        value="$0"
        icon={DollarSign}
        unavailable
        change={{ direction: "up", text: "10%", tone: "neutral", spoken: "Up 10%" }}
      />,
    );
    expect(screen.queryByText("Up 10%")).not.toBeInTheDocument();
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
