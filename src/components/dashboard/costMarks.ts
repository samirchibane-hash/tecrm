export type CostStatus = "success" | "warning" | "danger";

export const TEXT: Record<CostStatus, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

// Shape as well as color, so the three states survive color blindness and print:
// circle = at or under target, square = up to 25% over, triangle = further over.
export const MARK: Record<CostStatus, string> = {
  success: "h-2 w-2 rounded-full bg-success",
  warning: "h-2 w-2 rounded-[2px] bg-warning",
  danger: "h-0 w-0 border-x-[5px] border-b-[8px] border-x-transparent border-b-danger",
};
