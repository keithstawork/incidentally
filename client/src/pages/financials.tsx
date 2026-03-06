import { memo, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { formatCurrency } from "@/lib/formatters";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";

interface FinancialBucket {
  label: string;
  claimCount: number;
  openCount: number;
  closedCount: number;
  w2Count: number;
  ioccCount: number;
  lossesPaid: number;
  medicalIncurred: number;
  lae: number;
  reserves: number;
  totalIncurred: number;
}

interface TopClaim {
  id: number;
  name: string;
  proId: string;
  injuryType: string;
  dateOfInjury: string;
  workerType: string;
  totalIncurred: number;
  lossesPaid: number;
  medicalIncurred: number;
}

interface FinancialsData {
  openSummary: FinancialBucket;
  allSummary: FinancialBucket;
  byCalendarYear: FinancialBucket[];
  byPolicyYear: FinancialBucket[];
  byWorkerType: FinancialBucket[];
  topClaimsByIncurred: TopClaim[];
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

const fmtFull = (n: number) => formatCurrency(n);

function SummaryCards({ bucket, title }: { bucket: FinancialBucket; title: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Claims</p>
            <p className="mt-1 text-lg font-bold">{bucket.claimCount}</p>
            <p className="text-[10px] text-muted-foreground">{bucket.openCount} open / {bucket.closedCount} closed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total Incurred</p>
            <p className="mt-1 text-lg font-bold text-[#3B5747]">{fmt(bucket.totalIncurred)}</p>
            <p className="text-[10px] text-muted-foreground">Paid + reserves</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Losses Paid</p>
            <p className="mt-1 text-lg font-bold">{fmt(bucket.lossesPaid)}</p>
            <p className="text-[10px] text-muted-foreground">Indemnity + medical</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Medical Incurred</p>
            <p className="mt-1 text-lg font-bold">{fmt(bucket.medicalIncurred)}</p>
            <p className="text-[10px] text-muted-foreground">Paid + reserves</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">LAE</p>
            <p className="mt-1 text-lg font-bold">{fmt(bucket.lae)}</p>
            <p className="text-[10px] text-muted-foreground">Adjustment expenses</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">W2 / 1099</p>
            <p className="mt-1 text-lg font-bold">{bucket.w2Count} <span className="text-muted-foreground font-normal">/</span> {bucket.ioccCount}</p>
            <p className="text-[10px] text-muted-foreground">Worker type split</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FinancialTable({ buckets, yearLabel }: { buckets: FinancialBucket[]; yearLabel: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 pr-4 font-medium">{yearLabel}</th>
            <th className="py-2 pr-4 font-medium text-right">Claims</th>
            <th className="py-2 pr-4 font-medium text-right">Open</th>
            <th className="py-2 pr-4 font-medium text-right">W2</th>
            <th className="py-2 pr-4 font-medium text-right">1099</th>
            <th className="py-2 pr-4 font-medium text-right">Losses Paid</th>
            <th className="py-2 pr-4 font-medium text-right">Medical Incurred</th>
            <th className="py-2 pr-4 font-medium text-right">LAE</th>
            <th className="py-2 pr-4 font-medium text-right">Reserves</th>
            <th className="py-2 font-medium text-right">Total Incurred</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.label} className="border-b last:border-0 hover:bg-muted/30">
              <td className="py-2 pr-4 font-medium">{b.label}</td>
              <td className="py-2 pr-4 text-right">{b.claimCount}</td>
              <td className="py-2 pr-4 text-right">{b.openCount}</td>
              <td className="py-2 pr-4 text-right">{b.w2Count}</td>
              <td className="py-2 pr-4 text-right">{b.ioccCount}</td>
              <td className="py-2 pr-4 text-right">{fmtFull(b.lossesPaid)}</td>
              <td className="py-2 pr-4 text-right">{fmtFull(b.medicalIncurred)}</td>
              <td className="py-2 pr-4 text-right">{fmtFull(b.lae)}</td>
              <td className="py-2 pr-4 text-right">{fmtFull(b.reserves)}</td>
              <td className="py-2 text-right font-semibold text-[#3B5747]">{fmtFull(b.totalIncurred)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 font-semibold">
            <td className="py-2 pr-4">Total</td>
            <td className="py-2 pr-4 text-right">{buckets.reduce((s, b) => s + b.claimCount, 0)}</td>
            <td className="py-2 pr-4 text-right">{buckets.reduce((s, b) => s + b.openCount, 0)}</td>
            <td className="py-2 pr-4 text-right">{buckets.reduce((s, b) => s + b.w2Count, 0)}</td>
            <td className="py-2 pr-4 text-right">{buckets.reduce((s, b) => s + b.ioccCount, 0)}</td>
            <td className="py-2 pr-4 text-right">{fmtFull(buckets.reduce((s, b) => s + b.lossesPaid, 0))}</td>
            <td className="py-2 pr-4 text-right">{fmtFull(buckets.reduce((s, b) => s + b.medicalIncurred, 0))}</td>
            <td className="py-2 pr-4 text-right">{fmtFull(buckets.reduce((s, b) => s + b.lae, 0))}</td>
            <td className="py-2 pr-4 text-right">{fmtFull(buckets.reduce((s, b) => s + b.reserves, 0))}</td>
            <td className="py-2 text-right text-[#3B5747]">{fmtFull(buckets.reduce((s, b) => s + b.totalIncurred, 0))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

const CHART_COLORS = {
  lossesPaid: "#294EB2",
  medicalIncurred: "#3B5747",
  lae: "#C4A27F",
  reserves: "#576270",
};

const YearChart = memo(function YearChart({ buckets, yearLabel }: { buckets: FinancialBucket[]; yearLabel: string }) {
  const chartData = useMemo(() => buckets.map(b => ({
    name: b.label,
    "Losses Paid": b.lossesPaid,
    "Medical Incurred": b.medicalIncurred,
    LAE: b.lae,
    Reserves: b.reserves,
  })), [buckets]);

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            label={{ value: yearLabel, position: "insideBottom", offset: -2, fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          />
          <YAxis
            tick={{ fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => fmt(v)}
          />
          <Tooltip
            formatter={(value: number) => fmtFull(value)}
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
              fontSize: "12px",
            }}
          />
          <Legend wrapperStyle={{ fontSize: "10px" }} />
          <Bar dataKey="Losses Paid" fill={CHART_COLORS.lossesPaid} radius={[0, 0, 0, 0]} />
          <Bar dataKey="Medical Incurred" fill={CHART_COLORS.medicalIncurred} radius={[0, 0, 0, 0]} />
          <Bar dataKey="LAE" fill={CHART_COLORS.lae} radius={[0, 0, 0, 0]} />
          <Bar dataKey="Reserves" fill={CHART_COLORS.reserves} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});

const ClaimsCountChart = memo(function ClaimsCountChart({ buckets, yearLabel }: { buckets: FinancialBucket[]; yearLabel: string }) {
  const chartData = useMemo(() => buckets.map(b => ({
    name: b.label,
    W2: b.w2Count,
    "1099": b.ioccCount,
  })), [buckets]);

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            label={{ value: yearLabel, position: "insideBottom", offset: -2, fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          />
          <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
              fontSize: "12px",
            }}
          />
          <Legend wrapperStyle={{ fontSize: "10px" }} />
          <Bar dataKey="W2" stackId="a" fill="#3B5747" />
          <Bar dataKey="1099" stackId="a" fill="#EC5A53" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});

export function FinancialsContent() {
  const { data, isLoading } = useQuery<FinancialsData>({
    queryKey: ["/api/financials"],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-md" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-md" />
        <Skeleton className="h-72 rounded-md" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8">

      {/* Open Claims Summary */}
      <SummaryCards bucket={data.openSummary} title="Open Claims" />

      {/* All Claims Summary */}
      <SummaryCards bucket={data.allSummary} title="All Claims" />

      {/* W2 vs 1099 comparison */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <h3 className="text-sm font-semibold">W2 vs 1099 Comparison</h3>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <FinancialTable buckets={data.byWorkerType} yearLabel="Worker Type" />
        </CardContent>
      </Card>

      {/* Calendar Year */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold">By Calendar Year</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="p-4 pb-2">
              <h3 className="text-sm font-semibold">Financial Summary</h3>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <YearChart buckets={data.byCalendarYear} yearLabel="Calendar Year" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-4 pb-2">
              <h3 className="text-sm font-semibold">Claim Volume</h3>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <ClaimsCountChart buckets={data.byCalendarYear} yearLabel="Calendar Year" />
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardContent className="p-4">
            <FinancialTable buckets={data.byCalendarYear} yearLabel="Calendar Year" />
          </CardContent>
        </Card>
      </div>

      {/* Policy Year */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">By Policy Year</h2>
          <p className="text-xs text-muted-foreground">WC and OccAcc policies run April 30 &ndash; April 30</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="p-4 pb-2">
              <h3 className="text-sm font-semibold">Financial Summary</h3>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <YearChart buckets={data.byPolicyYear} yearLabel="Policy Year" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-4 pb-2">
              <h3 className="text-sm font-semibold">Claim Volume</h3>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <ClaimsCountChart buckets={data.byPolicyYear} yearLabel="Policy Year" />
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardContent className="p-4">
            <FinancialTable buckets={data.byPolicyYear} yearLabel="Policy Year" />
          </CardContent>
        </Card>
      </div>

      {/* Top Claims by Incurred */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Top Claims by Total Incurred</h3>
            <span className="text-[10px] text-muted-foreground">Top 20</span>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Pro ID</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 font-medium">Injury</th>
                  <th className="py-2 pr-4 font-medium">Date</th>
                  <th className="py-2 pr-4 font-medium text-right">Losses Paid</th>
                  <th className="py-2 pr-4 font-medium text-right">Medical</th>
                  <th className="py-2 font-medium text-right">Total Incurred</th>
                </tr>
              </thead>
              <tbody>
                {data.topClaimsByIncurred.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 pr-4">
                      <Link href={`/claims/${c.id}`} className="text-primary hover:underline font-medium">
                        {c.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 font-mono text-muted-foreground">{c.proId || "—"}</td>
                    <td className="py-2 pr-4">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${c.workerType === "W2" ? "bg-[#3B5747]/15 text-[#23342B] dark:bg-[#3B5747]/20 dark:text-[#B1BCB5]" : "bg-[#EC5A53]/15 text-[#8E3632] dark:bg-[#EC5A53]/20 dark:text-[#F7A9A9]"}`}>
                        {c.workerType}
                      </span>
                    </td>
                    <td className="py-2 pr-4 truncate max-w-[140px]" title={c.injuryType}>{c.injuryType || "—"}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{c.dateOfInjury ? new Date(c.dateOfInjury).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</td>
                    <td className="py-2 pr-4 text-right">{fmtFull(c.lossesPaid)}</td>
                    <td className="py-2 pr-4 text-right">{fmtFull(c.medicalIncurred)}</td>
                    <td className="py-2 text-right font-semibold text-[#3B5747]">{fmtFull(c.totalIncurred)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Financials() {
  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Financials</h1>
        <p className="text-sm text-muted-foreground">Loss and reserve analysis across all claims</p>
      </div>
      <FinancialsContent />
    </div>
  );
}
