import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Search,
  Plus,
  Download,
  X,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
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

interface ColumnDef {
  key: string;
  label: string;
  defaultWidth: number;
  minWidth: number;
  getValue: (claim: Claim) => string;
  render?: (claim: Claim) => React.ReactNode;
  filterable: boolean;
}

const COLUMNS: ColumnDef[] = [
  {
    key: "id",
    label: "ID",
    defaultWidth: 60,
    minWidth: 45,
    getValue: (c) => String(c.id),
    render: (c) => (
      <Link
        href={`/claims/${c.id}`}
        className="text-primary underline-offset-2 hover:underline font-mono text-muted-foreground"
        data-testid={`link-claim-${c.id}`}
      >
        #{c.id}
      </Link>
    ),
    filterable: false,
  },
  {
    key: "claimant",
    label: "Claimant",
    defaultWidth: 150,
    minWidth: 100,
    getValue: (c) => `${c.lastName}, ${c.firstName}`,
    render: (c) => (
      <Link href={`/claims/${c.id}`} className="font-medium hover:underline underline-offset-2">
        {c.lastName}, {c.firstName}
      </Link>
    ),
    filterable: false,
  },
  {
    key: "tpaClaimId",
    label: "TPA ID",
    defaultWidth: 90,
    minWidth: 60,
    getValue: (c) => c.tpaClaimId || "TBD",
    render: (c) => (
      <span className="font-mono text-muted-foreground text-[11px]">
        {c.tpaClaimId || "TBD"}
      </span>
    ),
    filterable: false,
  },
  {
    key: "dateOfInjury",
    label: "DOI",
    defaultWidth: 85,
    minWidth: 70,
    getValue: (c) => formatDate(c.dateOfInjury),
    render: (c) => <span className="text-muted-foreground">{formatDate(c.dateOfInjury)}</span>,
    filterable: false,
  },
  {
    key: "age",
    label: "Age",
    defaultWidth: 50,
    minWidth: 40,
    getValue: (c) => claimAge(c.dateOfInjury),
    render: (c) => <span className="text-muted-foreground">{claimAge(c.dateOfInjury)}</span>,
    filterable: false,
  },
  {
    key: "workerType",
    label: "Type",
    defaultWidth: 55,
    minWidth: 45,
    getValue: (c) => c.workerType,
    render: (c) => <span className="text-[10px] font-medium">{c.workerType}</span>,
    filterable: true,
  },
  {
    key: "claimStatus",
    label: "Status",
    defaultWidth: 110,
    minWidth: 80,
    getValue: (c) => c.claimStatus || "Open",
    render: (c) => (
      <span
        className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${STATUS_BADGE_VARIANTS[c.claimStatus || "Open"]}`}
      >
        {c.claimStatus}
      </span>
    ),
    filterable: true,
  },
  {
    key: "stage",
    label: "Stage",
    defaultWidth: 105,
    minWidth: 80,
    getValue: (c) => STAGE_LABELS[c.stage] || c.stage,
    render: (c) => (
      <span
        className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${STAGE_BADGE_VARIANTS[c.stage]}`}
      >
        {STAGE_LABELS[c.stage]}
      </span>
    ),
    filterable: true,
  },
  {
    key: "partnerName",
    label: "Partner",
    defaultWidth: 160,
    minWidth: 80,
    getValue: (c) => c.partnerName,
    render: (c) => (
      <span className="truncate block" title={c.partnerName}>
        {c.partnerName}
      </span>
    ),
    filterable: true,
  },
  {
    key: "stateOfInjury",
    label: "ST",
    defaultWidth: 45,
    minWidth: 35,
    getValue: (c) => c.stateOfInjury || "-",
    render: (c) => <span className="text-center font-mono">{c.stateOfInjury || "-"}</span>,
    filterable: true,
  },
  {
    key: "injuryType",
    label: "Injury",
    defaultWidth: 120,
    minWidth: 70,
    getValue: (c) => c.injuryType || "-",
    render: (c) => (
      <span className="truncate block text-muted-foreground" title={c.injuryType || undefined}>
        {c.injuryType || "-"}
      </span>
    ),
    filterable: true,
  },
  {
    key: "tnsSpecialist",
    label: "T&S",
    defaultWidth: 90,
    minWidth: 60,
    getValue: (c) => c.tnsSpecialist || "-",
    render: (c) => <span className="text-muted-foreground">{c.tnsSpecialist || "-"}</span>,
    filterable: true,
  },
];

function ColumnFilterPopover({
  column,
  claims,
  activeValues,
  onToggle,
  onClear,
}: {
  column: ColumnDef;
  claims: Claim[];
  activeValues: Set<string>;
  onToggle: (value: string) => void;
  onClear: () => void;
}) {
  const [filterSearch, setFilterSearch] = useState("");
  const uniqueValues = useMemo(() => {
    const vals = new Map<string, number>();
    claims.forEach((c) => {
      const v = column.getValue(c);
      vals.set(v, (vals.get(v) || 0) + 1);
    });
    return Array.from(vals.entries())
      .sort((a, b) => b[1] - a[1]);
  }, [claims, column]);

  const filtered = filterSearch
    ? uniqueValues.filter(([v]) => v.toLowerCase().includes(filterSearch.toLowerCase()))
    : uniqueValues;

  const isActive = activeValues.size > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`ml-0.5 p-0.5 rounded hover:bg-accent/50 ${isActive ? "text-primary" : "text-muted-foreground/50 hover:text-muted-foreground"}`}
          data-testid={`filter-col-${column.key}`}
        >
          <Filter className="h-2.5 w-2.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Filter {column.label}</span>
            {isActive && (
              <button
                className="text-[10px] text-primary hover:underline"
                onClick={onClear}
                data-testid={`clear-filter-${column.key}`}
              >
                Clear
              </button>
            )}
          </div>
          {uniqueValues.length > 8 && (
            <Input
              placeholder="Search..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="h-7 text-xs"
              data-testid={`input-filter-search-${column.key}`}
            />
          )}
          <ScrollArea className="max-h-48">
            <div className="space-y-0.5">
              {filtered.map(([value, count]) => (
                <label
                  key={value}
                  className="flex items-center gap-2 px-1 py-1 rounded hover:bg-accent/50 cursor-pointer text-xs"
                >
                  <Checkbox
                    checked={activeValues.has(value)}
                    onCheckedChange={() => onToggle(value)}
                    className="h-3.5 w-3.5"
                    data-testid={`checkbox-filter-${column.key}-${value}`}
                  />
                  <span className="flex-1 truncate">{value}</span>
                  <span className="text-[10px] text-muted-foreground">{count}</span>
                </label>
              ))}
              {filtered.length === 0 && (
                <p className="text-[10px] text-muted-foreground px-1 py-2">No matches</p>
              )}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function ClaimsList() {
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [activePreset, setActivePreset] = useState("All Claims");
  const [columnFilters, setColumnFilters] = useState<Record<string, Set<string>>>({});
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    COLUMNS.forEach((col) => {
      initial[col.key] = col.defaultWidth;
    });
    return initial;
  });
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const resizingRef = useRef<{
    colKey: string;
    startX: number;
    startWidth: number;
  } | null>(null);

  const { toast } = useToast();

  const queryParams = new URLSearchParams();
  Object.entries(activeFilters).forEach(([key, value]) => {
    if (value) queryParams.set(key, value);
  });
  if (search) queryParams.set("search", search);

  const queryString = queryParams.toString();
  const { data: allClaims = [], isLoading } = useQuery<Claim[]>({
    queryKey: ["/api/claims", "list", queryString],
    queryFn: async () => {
      const res = await fetch(`/api/claims${queryString ? `?${queryString}` : ""}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch claims");
      return res.json();
    },
  });

  const claims = useMemo(() => {
    let filtered = allClaims;

    const activeColumnFilters = Object.entries(columnFilters).filter(
      ([, values]) => values.size > 0
    );
    if (activeColumnFilters.length > 0) {
      filtered = filtered.filter((claim) =>
        activeColumnFilters.every(([colKey, values]) => {
          const col = COLUMNS.find((c) => c.key === colKey);
          if (!col) return true;
          return values.has(col.getValue(claim));
        })
      );
    }

    if (sortKey) {
      const col = COLUMNS.find((c) => c.key === sortKey);
      if (col) {
        filtered = [...filtered].sort((a, b) => {
          const va = col.getValue(a);
          const vb = col.getValue(b);
          const cmp = va.localeCompare(vb, undefined, { numeric: true });
          return sortDir === "asc" ? cmp : -cmp;
        });
      }
    }

    return filtered;
  }, [allClaims, columnFilters, sortKey, sortDir]);

  const handlePreset = (preset: (typeof FILTER_PRESETS)[0]) => {
    setActivePreset(preset.label);
    setActiveFilters(preset.filters);
  };

  const clearFilters = () => {
    setActiveFilters({});
    setActivePreset("All Claims");
    setSearch("");
    setColumnFilters({});
    setSortKey(null);
  };

  const hasActiveFilters =
    Object.keys(activeFilters).length > 0 ||
    search.length > 0 ||
    Object.values(columnFilters).some((s) => s.size > 0);

  const toggleColumnFilter = useCallback((colKey: string, value: string) => {
    setColumnFilters((prev) => {
      const existing = prev[colKey] || new Set<string>();
      const next = new Set(existing);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return { ...prev, [colKey]: next };
    });
  }, []);

  const clearColumnFilter = useCallback((colKey: string) => {
    setColumnFilters((prev) => {
      const next = { ...prev };
      delete next[colKey];
      return next;
    });
  }, []);

  const handleSort = useCallback(
    (colKey: string) => {
      if (sortKey === colKey) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(colKey);
        setSortDir("asc");
      }
    },
    [sortKey]
  );

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, colKey: string) => {
      e.preventDefault();
      e.stopPropagation();
      resizingRef.current = {
        colKey,
        startX: e.clientX,
        startWidth: columnWidths[colKey],
      };

      const handleMouseMove = (me: MouseEvent) => {
        if (!resizingRef.current) return;
        const delta = me.clientX - resizingRef.current.startX;
        const col = COLUMNS.find((c) => c.key === resizingRef.current!.colKey);
        const minW = col?.minWidth || 40;
        const newWidth = Math.max(minW, resizingRef.current.startWidth + delta);
        setColumnWidths((prev) => ({
          ...prev,
          [resizingRef.current!.colKey]: newWidth,
        }));
      };

      const handleMouseUp = () => {
        resizingRef.current = null;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [columnWidths]
  );

  const handleExportCsv = () => {
    if (!claims.length) return;
    const headers = [
      "ID", "TPA Claim ID", "First Name", "Last Name", "Date of Injury",
      "Worker Type", "Status", "Stage", "Partner", "State", "Injury Type",
    ];
    const rows = claims.map((c) => [
      c.id, c.tpaClaimId || "", c.firstName, c.lastName, c.dateOfInjury,
      c.workerType, c.claimStatus || "", c.stage, c.partnerName,
      c.stateOfInjury || "", c.injuryType || "",
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

  const activeColumnFilterCount = Object.values(columnFilters).filter((s) => s.size > 0).length;

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
              {activeColumnFilterCount > 0 &&
                ` · ${activeColumnFilterCount} column filter${activeColumnFilterCount > 1 ? "s" : ""}`}
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
        ) : claims.length === 0 && !hasActiveFilters ? (
          <div className="flex flex-col items-center justify-center h-full py-20 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Search className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-medium">No claims found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Create your first claim to get started.
            </p>
            <Button size="sm" asChild className="mt-4" data-testid="button-empty-new-claim">
              <Link href="/claims/new">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                New Claim
              </Link>
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-visible">
            <table className="text-xs" style={{ minWidth: Object.values(columnWidths).reduce((a, b) => a + b, 0) + "px" }}>
              <thead className="sticky top-0 z-10 bg-muted/50 backdrop-blur-sm">
                <tr className="border-b">
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className="relative text-left text-[11px] uppercase tracking-wider font-medium text-muted-foreground px-3 py-2 select-none"
                      style={{ width: columnWidths[col.key], minWidth: col.minWidth }}
                    >
                      <div className="flex items-center gap-0.5">
                        <button
                          className="flex items-center gap-0.5 hover:text-foreground transition-colors"
                          onClick={() => handleSort(col.key)}
                          data-testid={`sort-${col.key}`}
                        >
                          <span className="truncate">{col.label}</span>
                          {sortKey === col.key && (
                            sortDir === "asc" ? (
                              <ArrowUp className="h-2.5 w-2.5 text-primary" />
                            ) : (
                              <ArrowDown className="h-2.5 w-2.5 text-primary" />
                            )
                          )}
                        </button>
                        {col.filterable && (
                          <ColumnFilterPopover
                            column={col}
                            claims={allClaims}
                            activeValues={columnFilters[col.key] || new Set()}
                            onToggle={(v) => toggleColumnFilter(col.key, v)}
                            onClear={() => clearColumnFilter(col.key)}
                          />
                        )}
                      </div>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 z-20"
                        onMouseDown={(e) => handleResizeStart(e, col.key)}
                        data-testid={`resize-${col.key}`}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {claims.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Search className="h-5 w-5" />
                        <span>No claims match your filters.</span>
                        <button
                          className="text-primary text-xs hover:underline"
                          onClick={clearFilters}
                        >
                          Clear all filters
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  claims.map((claim) => (
                    <tr
                      key={claim.id}
                      className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                      data-testid={`row-claim-${claim.id}`}
                    >
                      {COLUMNS.map((col) => (
                        <td
                          key={col.key}
                          className="px-3 py-2 overflow-hidden"
                          style={{
                            width: columnWidths[col.key],
                            maxWidth: columnWidths[col.key],
                            minWidth: col.minWidth,
                          }}
                        >
                          {col.render ? col.render(claim) : col.getValue(claim)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
