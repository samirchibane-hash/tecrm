import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KillReview } from "@/components/kill-review/KillReview";
import { formatKillMoney } from "@/lib/killReview/format";
import { killReviewRuns, loadKillReviews } from "@/lib/killReview/load";

const runs = killReviewRuns();
const oct26 = runs.find((run) => run.runDate === "2026-10-26")!;
const oct22 = runs.find((run) => run.runDate === "2026-10-22")!;

function rowsFor(runDate: string) {
  return loadKillReviews({ runDate, hiddenAccounts: [], accounts: [] });
}

describe("KillReview", () => {
  it("does not render a number while the run is still loading", () => {
    render(<KillReview run={oct26} runs={runs} onRunDate={() => {}} rows={null} />);
    expect(screen.getByRole("status", { name: "Loading kill review" })).toBeInTheDocument();
    expect(screen.queryByText("$0.00")).not.toBeInTheDocument();
    expect(screen.queryByText("17")).not.toBeInTheDocument();
  });

  it("shows Yan's Oct 26 calls, the headline, and a stable number", () => {
    render(
      <KillReview run={oct26} runs={runs} onRunDate={() => {}} rows={rowsFor("2026-10-26")} />,
    );
    expect(screen.getAllByText("17").length).toBeGreaterThan(0);
    expect(screen.getAllByText(formatKillMoney(3940.39)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(formatKillMoney(1785.32)).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Turn off")).toHaveLength(8);
    expect(screen.getAllByText("Schedule (Meta pixel)").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Ad 1, Culligan Rochester")).toBeInTheDocument();
    expect(screen.getAllByText("Only live ad in this ad set").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Only live in ad set: unknown").length).toBeGreaterThan(0);

    for (const link of screen.getAllByRole("link", { name: /Ads Manager/ })) {
      const url = new URL(link.getAttribute("href") ?? "", "https://adsmanager.facebook.com");
      expect(url.searchParams.get("act")).toMatch(/^\d+$/);
    }
  });

  it("copies the selected stable numbers", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(
      <KillReview run={oct26} runs={runs} onRunDate={() => {}} rows={rowsFor("2026-10-26")} />,
    );
    for (const n of [3, 4, 6]) {
      fireEvent.click(screen.getByRole("checkbox", { name: `Select ad ${n}` }));
    }
    expect(screen.getByText("turn off 3, 4, 6")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy reply" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("turn off 3, 4, 6"));
    expect(screen.getByLabelText("Ad 3, Culligan Rochester")).toHaveTextContent("3");
  });

  it("renders the Oct 22 run with flags and no verdicts", () => {
    render(
      <KillReview run={oct22} runs={runs} onRunDate={() => {}} rows={rowsFor("2026-10-22")} />,
    );
    expect(screen.getAllByText("No verdict")).toHaveLength(16);
    expect(screen.getAllByText("No verdicts on this run").length).toBeGreaterThan(0);
    expect(screen.queryByText("Turn off")).not.toBeInTheDocument();
    expect(screen.queryByText("Yan")).not.toBeInTheDocument();
    expect(screen.getAllByText("Only live in ad set: unknown")).toHaveLength(16);
    expect(screen.queryByText("$0.00", { selector: "p" })).not.toBeInTheDocument();
  });
});
