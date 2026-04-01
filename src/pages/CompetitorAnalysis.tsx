import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Search, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Ad {
  id?: string;
  pageId?: string;
  pageName?: string;
  adCreativeBody?: string;
  adCreativeLinkTitle?: string;
  adCreativeLinkCaption?: string;
  adSnapshotUrl?: string;
  adCreativeImageUrls?: string[];
  adDeliveryStartTime?: string;
  adDeliveryStopTime?: string;
  currency?: string;
  impressionsLowerBound?: number;
  impressionsUpperBound?: number;
  spendLowerBound?: number;
  spendUpperBound?: number;
  platforms?: string[];
}

const COUNTRIES = [
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
  { value: "GB", label: "United Kingdom" },
  { value: "AU", label: "Australia" },
];

const AD_TYPES = [
  { value: "ALL", label: "All Ads" },
  { value: "POLITICAL_AND_ISSUE_ADS", label: "Political & Issue" },
];

const CompetitorAnalysis = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [country, setCountry] = useState("US");
  const [adType, setAdType] = useState("ALL");
  const [limit, setLimit] = useState("20");
  const [loading, setLoading] = useState(false);
  const [ads, setAds] = useState<Ad[]>([]);
  const [searched, setSearched] = useState(false);

  const runSearch = async () => {
    if (!searchTerm.trim()) return;
    setLoading(true);
    setSearched(true);
    setAds([]);
    try {
      const { data, error } = await supabase.functions.invoke("apify-competitor", {
        body: { searchTerms: searchTerm.trim(), country, adType, limit: parseInt(limit) },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      setAds(data.ads ?? []);
      if (data.ads?.length === 0) toast.info("No ads found for that search.");
    } catch (err: any) {
      toast.error(`Search failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Competitor Analysis</h1>
          <p className="text-sm text-muted-foreground">Spy on competitor ads via the Facebook Ads Library</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-wrap gap-3 mb-8 p-4 border border-border rounded-xl bg-card">
        <Input
          placeholder="Competitor name or Facebook page..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch()}
          className="flex-1 min-w-[200px]"
        />
        <Select value={country} onValueChange={setCountry}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COUNTRIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={adType} onValueChange={setAdType}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AD_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={limit} onValueChange={setLimit}>
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["10", "20", "50"].map((n) => (
              <SelectItem key={n} value={n}>{n} ads</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={runSearch} disabled={loading || !searchTerm.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
          {loading ? "Searching..." : "Search"}
        </Button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Fetching ads from Facebook Ads Library — this can take up to 30 seconds...</p>
        </div>
      )}

      {/* Results */}
      {!loading && searched && ads.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground mb-4">{ads.length} ads found for <span className="font-medium text-foreground">"{searchTerm}"</span></p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ads.map((ad, i) => (
              <div key={ad.id ?? i} className="border border-border rounded-xl bg-card overflow-hidden flex flex-col">
                {/* Ad image */}
                {ad.adCreativeImageUrls?.[0] && (
                  <img
                    src={ad.adCreativeImageUrls[0]}
                    alt="Ad creative"
                    className="w-full h-48 object-cover"
                  />
                )}
                <div className="p-4 flex flex-col gap-2 flex-1">
                  {/* Page name */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">{ad.pageName ?? "Unknown Page"}</span>
                    {ad.adSnapshotUrl && (
                      <a href={ad.adSnapshotUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                      </a>
                    )}
                  </div>

                  {/* Ad copy */}
                  {ad.adCreativeBody && (
                    <p className="text-xs text-muted-foreground line-clamp-3">{ad.adCreativeBody}</p>
                  )}
                  {ad.adCreativeLinkTitle && (
                    <p className="text-xs font-medium truncate">{ad.adCreativeLinkTitle}</p>
                  )}

                  {/* Meta */}
                  <div className="flex flex-wrap gap-1 mt-auto pt-2">
                    {ad.platforms?.map((p) => (
                      <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
                    ))}
                    {ad.adDeliveryStartTime && (
                      <Badge variant="outline" className="text-xs">
                        Active since {new Date(ad.adDeliveryStartTime).toLocaleDateString()}
                      </Badge>
                    )}
                    {ad.impressionsLowerBound != null && (
                      <Badge variant="outline" className="text-xs">
                        {ad.impressionsLowerBound.toLocaleString()}–{ad.impressionsUpperBound?.toLocaleString()} impressions
                      </Badge>
                    )}
                    {ad.spendLowerBound != null && (
                      <Badge variant="outline" className="text-xs">
                        ${ad.spendLowerBound.toLocaleString()}–${ad.spendUpperBound?.toLocaleString()} spend
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Empty state */}
      {!loading && searched && ads.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
          <Search className="h-8 w-8" />
          <p>No ads found. Try a different search term.</p>
        </div>
      )}

      {/* Initial state */}
      {!searched && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
          <Search className="h-10 w-10 opacity-30" />
          <p className="text-sm">Search for a competitor's Facebook page to see their active ads.</p>
        </div>
      )}
    </div>
  );
};

export default CompetitorAnalysis;
