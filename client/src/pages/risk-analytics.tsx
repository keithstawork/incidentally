import { useMemo, memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Loader2 } from "lucide-react";
import { formatNumberCompact } from "@/lib/formatters";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
  Legend,
} from "recharts";

interface IncidentRate {
  label: string;
  claimCount: number;
  shiftCount: number;
  rate: number;
}

interface ShiftDetail {
  claimId: number;
  claimantName: string;
  proId: string;
  injuryType: string;
  dateOfInjury: string;
  shiftPosition: string;
  partnerName: string;
  partnerState: string;
  workerType: string;
  shiftStartHour: number | null;
  shiftDurationHours: number | null;
  dayOfWeek: string | null;
  businessName: string | null;
  shiftState: string | null;
}

interface RiskAnalyticsData {
  byPosition: IncidentRate[];
  byState: IncidentRate[];
  byPartner: IncidentRate[];
  byWorkerType: IncidentRate[];
  openClaimShiftDetails: ShiftDetail[];
  shiftVolumeAvailable: boolean;
}

const fmtNum = formatNumberCompact;

function rateColor(rate: number, max: number): string {
  const pct = max > 0 ? rate / max : 0;
  if (pct > 0.7) return "#EC5A53";
  if (pct > 0.4) return "#C4A27F";
  return "#3B5747";
}

function IncidentRateTable({ data, title, subtitle }: { data: IncidentRate[]; title: string; subtitle?: string }) {
  const maxRate = Math.max(...data.map(d => d.rate), 0);
  const maxShifts = Math.max(...data.map(d => d.shiftCount), 0);

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3 font-medium">{title.replace("Incident Rate by ", "")}</th>
                <th className="py-2 pr-3 font-medium text-right">Claims</th>
                <th className="py-2 pr-3 font-medium text-right">Shifts</th>
                <th className="py-2 pr-3 font-medium text-right">Rate</th>
                <th className="py-2 font-medium w-32"></th>
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 20).map((d) => (
                <tr key={d.label} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="py-1.5 pr-3 font-medium max-w-[200px] truncate" title={d.label}>{d.label}</td>
                  <td className="py-1.5 pr-3 text-right">{d.claimCount}</td>
                  <td className="py-1.5 pr-3 text-right text-muted-foreground">{fmtNum(d.shiftCount)}</td>
                  <td className="py-1.5 pr-3 text-right font-semibold" style={{ color: rateColor(d.rate, maxRate) }}>
                    {d.rate.toFixed(2)}
                  </td>
                  <td className="py-1.5">
                    <div className="flex items-center gap-1">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${maxShifts > 0 ? (d.shiftCount / maxShifts) * 100 : 0}%`,
                            backgroundColor: "#294EB2",
                            opacity: 0.3,
                          }}
                        />
                      </div>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden -ml-[calc(100%-2px)]">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${maxRate > 0 ? (d.rate / maxRate) * 100 : 0}%`,
                            backgroundColor: rateColor(d.rate, maxRate),
                          }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

const RateBarChart = memo(function RateBarChart({ data, title }: { data: IncidentRate[]; title: string }) {
  const { maxRate, chartData } = useMemo(() => {
    const mr = Math.max(...data.map(d => d.rate), 0);
    const top15 = data.slice(0, 15);
    return {
      maxRate: mr,
      chartData: top15.map(d => ({
        name: d.label.length > 20 ? d.label.slice(0, 18) + "..." : d.label,
        fullName: d.label,
        rate: Math.round(d.rate * 100) / 100,
        claims: d.claimCount,
        shifts: d.shiftCount,
      })),
    };
  }, [data]);

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-[10px] text-muted-foreground">Claims per 1,000 shifts</p>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={120} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(value: number) => [`${value.toFixed(2)} per 1K shifts`, "Incident Rate"]}
                labelFormatter={(label) => {
                  const item = chartData.find(d => d.name === label);
                  return item ? `${item.fullName} (${item.claims} claims / ${fmtNum(item.shifts)} shifts)` : label;
                }}
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, idx) => (
                  <Cell key={idx} fill={rateColor(entry.rate, maxRate)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
});

const VolumeVsRateScatter = memo(function VolumeVsRateScatter({ data, title }: { data: IncidentRate[]; title: string }) {
  const chartData = useMemo(() => {
    return data.filter(d => d.shiftCount > 0 && d.claimCount > 0).map(d => ({
      x: d.shiftCount,
      y: d.rate,
      z: d.claimCount,
      name: d.label,
    }));
  }, [data]);

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-[10px] text-muted-foreground">Bubble size = claim count. Top-right = high volume + high risk.</p>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="x"
                type="number"
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                name="Shifts"
                tickFormatter={(v: number) => fmtNum(v)}
                label={{ value: "Shift Volume", position: "insideBottom", offset: -2, fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                dataKey="y"
                type="number"
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                name="Rate"
                label={{ value: "Rate per 1K", angle: -90, position: "insideLeft", offset: 5, fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              />
              <ZAxis dataKey="z" range={[40, 400]} name="Claims" />
              <Tooltip
                content={({ payload }) => {
                  if (!payload || payload.length === 0) return null;
                  const p = payload[0].payload;
                  return (
                    <div className="bg-popover border border-border rounded-md p-2 shadow text-xs">
                      <p className="font-semibold">{p.name}</p>
                      <p>Shifts: {fmtNum(p.x)}</p>
                      <p>Rate: {p.y.toFixed(2)} per 1K</p>
                      <p>Claims: {p.z}</p>
                    </div>
                  );
                }}
              />
              <Scatter data={chartData} fill="#294EB2" fillOpacity={0.6} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
});

const DAYS_ORDER = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const ShiftPatternAnalysis = memo(function ShiftPatternAnalysis({ details }: { details: ShiftDetail[] }) {
  const { dayData, hourData, topPartners, topStates, positionBreakdowns, glDetails, waDetails } = useMemo(() => {
    const dayDistribution = new Map<string, number>();
    const hourDistribution = new Map<number, number>();
    const injuryByPosition = new Map<string, Map<string, number>>();
    const partnerCounts = new Map<string, number>();
    const stateCounts = new Map<string, number>();

    details.forEach(d => {
      if (d.dayOfWeek) dayDistribution.set(d.dayOfWeek, (dayDistribution.get(d.dayOfWeek) || 0) + 1);
      if (d.shiftStartHour !== null) hourDistribution.set(d.shiftStartHour, (hourDistribution.get(d.shiftStartHour) || 0) + 1);
      if (d.shiftPosition && d.injuryType) {
        if (!injuryByPosition.has(d.shiftPosition)) injuryByPosition.set(d.shiftPosition, new Map());
        const inner = injuryByPosition.get(d.shiftPosition)!;
        inner.set(d.injuryType, (inner.get(d.injuryType) || 0) + 1);
      }
      if (d.partnerName) partnerCounts.set(d.partnerName, (partnerCounts.get(d.partnerName) || 0) + 1);
      if (d.partnerState) stateCounts.set(d.partnerState, (stateCounts.get(d.partnerState) || 0) + 1);
    });

    return {
      dayData: DAYS_ORDER.map(d => ({ day: d.slice(0, 3), count: dayDistribution.get(d) || 0 })),
      hourData: Array.from({ length: 24 }, (_, h) => ({
        hour: `${h.toString().padStart(2, "0")}:00`,
        count: hourDistribution.get(h) || 0,
      })).filter(d => d.count > 0),
      topPartners: Array.from(partnerCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10),
      topStates: Array.from(stateCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10),
      positionBreakdowns: Array.from(injuryByPosition.entries()).map(([pos, injuries]) => ({
        position: pos,
        total: details.filter(d => d.shiftPosition === pos).length,
        topInjuries: Array.from(injuries.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5),
      })),
      glDetails: details.filter(d => d.shiftPosition === "General Labor"),
      waDetails: details.filter(d => d.shiftPosition === "Warehouse Associate"),
    };
  }, [details]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-[#C4A27F]" />
          Open Claim Shift Analysis: General Labor &amp; Warehouse Associate
        </h2>
        <p className="text-xs text-muted-foreground">
          {details.length} open claims across these two positions. Analyzing shift patterns for risk factors.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">General Labor</p>
            <p className="mt-1 text-lg font-bold">{glDetails.length}</p>
            <p className="text-[10px] text-muted-foreground">open claims</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Warehouse Associate</p>
            <p className="mt-1 text-lg font-bold">{waDetails.length}</p>
            <p className="text-[10px] text-muted-foreground">open claims</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Top State</p>
            <p className="mt-1 text-lg font-bold">{topStates[0]?.[0] || "—"}</p>
            <p className="text-[10px] text-muted-foreground">{topStates[0]?.[1] || 0} claims</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Top Partner</p>
            <p className="mt-1 text-lg font-bold truncate" title={topPartners[0]?.[0]}>{topPartners[0]?.[0] || "—"}</p>
            <p className="text-[10px] text-muted-foreground">{topPartners[0]?.[1] || 0} claims</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Day of week distribution */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <h3 className="text-sm font-semibold">Incidents by Day of Week</h3>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dayData}>
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="count" fill="#294EB2" radius={[3, 3, 0, 0]} name="Incidents" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Start hour distribution */}
        {hourData.length > 0 ? (
          <Card>
            <CardHeader className="p-4 pb-2">
              <h3 className="text-sm font-semibold">Incidents by Shift Start Hour</h3>
              <p className="text-[10px] text-muted-foreground">Only claims with matched shift data</p>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourData}>
                    <XAxis dataKey="hour" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="count" fill="#C4A27F" radius={[3, 3, 0, 0]} name="Incidents" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="p-4 pb-2">
              <h3 className="text-sm font-semibold">Incidents by Shift Start Hour</h3>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-sm text-muted-foreground text-center py-8">No shift start time data available</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Injury types by position */}
      <div className="grid gap-4 lg:grid-cols-2">
        {positionBreakdowns.map(pb => (
          <Card key={pb.position}>
            <CardHeader className="p-4 pb-2">
              <h3 className="text-sm font-semibold">{pb.position} — Injury Breakdown</h3>
              <p className="text-[10px] text-muted-foreground">{pb.total} open claims</p>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="space-y-1.5">
                {pb.topInjuries.map(([type, count]) => {
                  const pct = Math.round((count / pb.total) * 100);
                  return (
                    <div key={type} className="flex items-center gap-2 text-xs">
                      <span className="w-40 truncate" title={type}>{type}</span>
                      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-[#C4A27F]/60 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="font-medium w-16 text-right">{count} ({pct}%)</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Top partners and states */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="p-4 pb-2">
            <h3 className="text-sm font-semibold">Top Partners (GL + WA Open Claims)</h3>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-1">
              {topPartners.map(([partner, count]) => {
                const pct = Math.round((count / details.length) * 100);
                return (
                  <div key={partner} className="flex items-center gap-2 text-xs py-0.5">
                    <span className="w-44 truncate" title={partner}>{partner}</span>
                    <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary/60 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="font-medium w-10 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <h3 className="text-sm font-semibold">Top States (GL + WA Open Claims)</h3>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-1">
              {topStates.map(([state, count]) => {
                const pct = Math.round((count / details.length) * 100);
                return (
                  <div key={state} className="flex items-center gap-2 text-xs py-0.5">
                    <span className="font-mono w-7 text-muted-foreground">{state}</span>
                    <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary/60 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="font-medium w-10 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

export function RiskAnalyticsContent() {
  const { data, isLoading, error } = useQuery<RiskAnalyticsData>({
    queryKey: ["/api/risk-analytics"],
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Loading risk analytics...</p>
            <p className="text-xs text-muted-foreground">
              Querying shift volume data from Redshift. This may take 15-30 seconds on first load.
            </p>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-md" />
          <Skeleton className="h-80 rounded-md" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <p className="text-sm text-muted-foreground">
        Failed to load risk analytics. The Redshift connection may be unavailable.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {!data.shiftVolumeAvailable && (
        <div className="p-3 bg-[#C4A27F]/10 dark:bg-[#C4A27F]/10 rounded-lg border border-[#C4A27F]/30 dark:border-[#C4A27F]/30">
          <p className="text-xs text-[#76614C] dark:text-[#E7DACC]">
            Shift volume data from Redshift is unavailable. Showing claim counts only — rates cannot be calculated.
          </p>
        </div>
      )}

      {/* W2 vs 1099 */}
      {data.byWorkerType.length > 0 && (
        <Card>
          <CardHeader className="p-4 pb-2">
            <h3 className="text-sm font-semibold">W2 vs 1099 Incident Rate</h3>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Worker Type</th>
                    <th className="py-2 pr-4 font-medium text-right">Claims</th>
                    <th className="py-2 pr-4 font-medium text-right">Shifts</th>
                    <th className="py-2 font-medium text-right">Rate (per 1K shifts)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byWorkerType.map(d => (
                    <tr key={d.label} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${d.label === "W2" ? "bg-[#3B5747]/15 text-[#23342B] dark:bg-[#3B5747]/20 dark:text-[#B1BCB5]" : "bg-[#EC5A53]/15 text-[#8E3632] dark:bg-[#EC5A53]/20 dark:text-[#F7A9A9]"}`}>
                          {d.label}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-right">{d.claimCount}</td>
                      <td className="py-2 pr-4 text-right text-muted-foreground">{fmtNum(d.shiftCount)}</td>
                      <td className="py-2 text-right font-semibold">{d.shiftCount > 0 ? d.rate.toFixed(2) : "N/A"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Position analysis */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RateBarChart data={data.byPosition} title="Incident Rate by Position" />
        <VolumeVsRateScatter data={data.byPosition} title="Position: Volume vs Risk" />
      </div>
      <IncidentRateTable data={data.byPosition} title="Incident Rate by Position" subtitle="Claims per 1,000 completed shifts" />

      {/* State analysis */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RateBarChart data={data.byState} title="Incident Rate by State" />
        <VolumeVsRateScatter data={data.byState} title="State: Volume vs Risk" />
      </div>
      <IncidentRateTable data={data.byState} title="Incident Rate by State" subtitle="Claims per 1,000 completed shifts" />

      {/* Partner analysis */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RateBarChart data={data.byPartner} title="Incident Rate by Partner" />
        <VolumeVsRateScatter data={data.byPartner} title="Partner: Volume vs Risk" />
      </div>
      <IncidentRateTable data={data.byPartner} title="Incident Rate by Partner" subtitle="Claims per 1,000 completed shifts" />

      {/* Deep dive on GL + WA open claims */}
      {data.openClaimShiftDetails.length > 0 && (
        <ShiftPatternAnalysis details={data.openClaimShiftDetails} />
      )}
    </div>
  );
}

export default function RiskAnalytics() {
  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Risk Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Incident rates normalized by shift volume
        </p>
      </div>
      <RiskAnalyticsContent />
    </div>
  );
}
