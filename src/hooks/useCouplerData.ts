import { useQuery } from "@tanstack/react-query";

const COUPLER_URL =
  "https://app.coupler.io/export/w/8c3caa8c-40bc-44c5-945a-f5a126bebb31.json?access_token=f4b13e2fad555ddc856d402c6db84de9c95c52f31235183c52113cfb444a";

export interface AdRow {
  "Account name": string;
  "Campaign name": string | null;
  spend: number | null;
  report_date: string | null;
}

async function fetchCouplerData(): Promise<AdRow[]> {
  const res = await fetch(COUPLER_URL);
  if (!res.ok) throw new Error("Failed to fetch Coupler.io data");
  const json = await res.json();
  // Coupler.io JSON export is usually an array of objects
  return Array.isArray(json) ? json : json.data ?? json.results ?? [];
}

export function useCouplerData() {
  return useQuery({
    queryKey: ["coupler-fb-ads"],
    queryFn: fetchCouplerData,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });
}
