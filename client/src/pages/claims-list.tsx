import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Search,
  Filter,
  Plus,
  Download,
  ChevronDown,
  X,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Claim } from "@shared/schema";

const STATUS_BADGE_VARIANTS: Record<string, string> = {
  Open: "bg-yellow-100 text-yellow-800 border-yellow-200",
  Closed: "bg-green-100 text-green-800 border-green-200",
  Denied: "bg-red-100 text-red-800 border-red-200",
  "Incident Only": "bg-gray-100 text-gray-600 border-gray-200",
  "Not reported/Incident only 1099": "bg-gray-100 text-gray-500 border-gray-200",
};

const STAGE_LABELS: Record<string, string> = {
  intake: "Intake",
  active_claim: "Active Claim",
  litigation: "Litigation",
  settled: "Settled",
  closed: "Closed",
};

const STAGE_BADGE_VARIANTS: Record<string, string> = {
  intake: "bg-blue-100 text-blue-700 border-blue-200",
  active_claim: "bg-purple-100 text-purple-700 border-purple-200",
  litigation: "bg-red-100 text-red-700 border-red-200",
  settled: "bg-emerald-100 text-emerald-700 border-emerald-200",
  closed: "bg-gray-100 text-gray-600 border-gray-200",
};

const FILTER_PRESETS = [
  { label: "All Claims", filters: {} },
  { label: "Open Claims", filters: { claimStatus: "Open" } },
  { label: "Litigation", filters: { litigated: "true" } },
  { label: "W2 Claims", filters: { workerType: "W2" } },
  { label: "1099 Claims", filters: { workerType: "1099" } },
  { label: "Intake Queue", filters: { stage: "intake" } },
  { label: "Active Claims", filters: { stage: "active_claim" } },
];

function formatDate(date: string | null | undefined): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "2-digit",
  });
}

function claimAge(dateOfInjury: string): string {
  const days = Math.floor(
    (Date.now() - new Date(dateOfInjury).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}yr`;
}

export default function ClaimsList() {
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [activePreset, setActivePreset] = useState("All Claims");
  const { toast } = useToast();

  const queryParams = new URLSearchParams();
  Object.entries(activeFilters).forEach(([key, value]) => {
    if (value) queryParams.set(key, value);
  });
  if (search) queryParams.set("search", search);

  const queryString = queryParams.toString();
  const { data: claims = [], isLoading } = useQuery<Claim[]>({
    queryKey: ["/api/claims", "list", queryString],
    queryFn: async () => {
      const res = await fetch(`/api/claims${queryString ? `?${queryString}` : ""}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch claims");
      return res.json();
    },
  });

  const handlePreset = (preset: (typeof FILTER_PRESETS)[0]) => {
    setActivePreset(preset.label);
    setActiveFilters(preset.filters);
  };

  const clearFilters = () => {
    setActiveFilters({});
    setActivePreset("All Claims");
    setSearch("");
  };

  const hasActiveFilters =
    Object.keys(activeFilters).length > 0 || search.length > 0;

  const handleExportCsv = () => {
    if (!claims.length) return;
    const headers = [
      "ID",
      "TPA Claim ID",
      "First Name",
      "Last Name",
      "Date of Injury",
      "Worker Type",
      "Status",
      "Stage",
      "Partner",
      "State",
      "Injury Type",
    ];
    const rows = claims.map((c) => [
      c.id,
      c.tpaClaimId || "",
      c.firstName,
      c.lastName,
      c.dateOfInjury,
      c.workerType,
      c.claimStatus || "",
      c.stage,
      c.partnerName,
      c.stateOfInjury || "",
      c.injuryType || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `claims-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Export complete", description: `${claims.length} claims exported.` });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background px-6 py-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold tracking-tight" data-testid="text-claims-title">
              Claims
            </h1>
            <p className="text-sm text-muted-foreground">
              {claims.length} {claims.length === 1 ? "claim" : "claims"}
              {activePreset !== "All Claims" && ` (${activePreset})`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={!claims.length}
              data-testid="button-export-csv"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export
            </Button>
            <Button size="sm" asChild data-testid="button-new-claim-list">
              <Link href="/claims/new">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                New Claim
              </Link>
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search claims..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
              data-testid="input-search-claims"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            {FILTER_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                variant={activePreset === preset.label ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs whitespace-nowrap"
                onClick={() => handlePreset(preset)}
                data-testid={`filter-${preset.label.toLowerCase().replace(/\s/g, "-")}`}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          <Select
            value={activeFilters.stateOfInjury || ""}
            onValueChange={(v) =>
              setActiveFilters((f) => ({ ...f, stateOfInjury: v === "all" ? "" : v }))
            }
          >
            <SelectTrigger className="h-7 w-[100px] text-xs" data-testid="select-state-filter">
              <SelectValue placeholder="State" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              {["CA", "GA", "TX", "FL", "NY", "NV", "AZ", "IL", "OH", "PA"].map(
                (s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={clearFilters}
              data-testid="button-clear-filters"
            >
              <X className="mr-1 h-3 w-3" />
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-6 space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))}
          </div>
        ) : claims.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-20 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Search className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-medium">No claims found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              {hasActiveFilters
                ? "Try adjusting your filters or search query."
                : "Create your first claim to get started."}
            </p>
            {!hasActiveFilters && (
              <Button size="sm" asChild className="mt-4" data-testid="button-empty-new-claim">
                <Link href="/claims/new">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  New Claim
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="text-[11px] uppercase tracking-wider">
                <TableHead className="w-[60px]">ID</TableHead>
                <TableHead>Claimant</TableHead>
                <TableHead className="w-[90px]">TPA ID</TableHead>
                <TableHead className="w-[80px]">DOI</TableHead>
                <TableHead className="w-[45px]">Age</TableHead>
                <TableHead className="w-[50px]">Type</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[100px]">Stage</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead className="w-[40px]">ST</TableHead>
                <TableHead className="w-[120px]">Injury</TableHead>
                <TableHead className="w-[90px]">T&S</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {claims.map((claim) => (
                <TableRow
                  key={claim.id}
                  className="text-xs cursor-pointer"
                  data-testid={`row-claim-${claim.id}`}
                >
                  <TableCell className="font-mono text-muted-foreground">
                    <Link
                      href={`/claims/${claim.id}`}
                      className="text-primary underline-offset-2 hover:underline"
                      data-testid={`link-claim-${claim.id}`}
                    >
                      #{claim.id}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/claims/${claim.id}`}>
                      {claim.lastName}, {claim.firstName}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground text-[11px]">
                    {claim.tpaClaimId || "TBD"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(claim.dateOfInjury)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {claimAge(claim.dateOfInjury)}
                  </TableCell>
                  <TableCell>
                    <span className="text-[10px] font-medium">{claim.workerType}</span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${STATUS_BADGE_VARIANTS[claim.claimStatus || "Open"]}`}
                    >
                      {claim.claimStatus}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${STAGE_BADGE_VARIANTS[claim.stage]}`}
                    >
                      {STAGE_LABELS[claim.stage]}
                    </span>
                  </TableCell>
                  <TableCell className="truncate max-w-[150px]" title={claim.partnerName}>
                    {claim.partnerName}
                  </TableCell>
                  <TableCell className="text-center font-mono">
                    {claim.stateOfInjury || "-"}
                  </TableCell>
                  <TableCell className="truncate max-w-[120px] text-muted-foreground" title={claim.injuryType || undefined}>
                    {claim.injuryType || "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {claim.tnsSpecialist || "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
