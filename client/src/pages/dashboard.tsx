import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  FileText,
  Plus,
  ArrowRight,
  ShieldCheck,
  Users,
  DollarSign,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { FinancialsContent } from "./financials";
import { RiskAnalyticsContent } from "./risk-analytics";
import { STATUS_COLORS } from "@/lib/constants";
import { formatCurrencyCompact, formatMonth } from "@/lib/formatters";

interface DashboardStats {
  totalClaims: number;
  totalOpen: number;
  totalClosed: number;
  totalIncurred: number;
  totalPayments: number;
  totalOutstanding: number;
  totalMedical: number;
  totalLAE: number;
  inLitigation: number;
  w2Claims: number;
  ioccClaims: number;
  statusBreakdown: { status: string; count: number }[];
  stageBreakdown: { stage: string; count: number }[];
  monthlyBreakdown: { month: string; count: number }[];
  workerTypeMonthly: { month: string; w2: number; iocc: number }[];
  byState: { state: string; count: number }[];
  byInjuryType: { type: string; count: number }[];
  byPosition: { position: string; count: number }[];
  repeatPros: { proId: string; name: string; count: number }[];
}


function OverviewContent({ stats }: { stats: DashboardStats }) {
  const statCards = [
    { label: "Open", value: stats.totalOpen, icon: FileText, color: "text-[#C4A27F]" },
    { label: "Total Incurred", value: formatCurrencyCompact(stats.totalIncurred), icon: DollarSign, color: "text-[#3B5747]", sub: "Open claims" },
    { label: "W2 Claims", value: stats.w2Claims, icon: Users, color: "text-[#3B5747]" },
    { label: "1099 Claims", value: stats.ioccClaims, icon: ShieldCheck, color: "text-[#EC5A53]" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  {stat.label}
                </p>
                <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
              </div>
              <p className="mt-1 text-2xl font-bold" data-testid={`stat-${stat.label.toLowerCase().replace(/\s/g, "-")}`}>
                {stat.value}
              </p>
              {stat.sub && (
                <p className="text-[10px] text-muted-foreground">{stat.sub}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Financials row */}
      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Losses Paid</p>
            <p className="mt-1 text-xl font-bold">{formatCurrencyCompact(stats.totalPayments)}</p>
            <p className="text-[10px] text-muted-foreground">Indemnity + medical, all claims</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Medical Incurred</p>
            <p className="mt-1 text-xl font-bold">{formatCurrencyCompact(stats.totalMedical)}</p>
            <p className="text-[10px] text-muted-foreground">Paid + reserves, all claims</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">LAE</p>
            <p className="mt-1 text-xl font-bold">{formatCurrencyCompact(stats.totalLAE)}</p>
            <p className="text-[10px] text-muted-foreground">Loss adjustment expenses</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total Incurred</p>
            <p className="mt-1 text-xl font-bold text-[#3B5747]">{formatCurrencyCompact(stats.totalIncurred)}</p>
            <p className="text-[10px] text-muted-foreground">Open claims</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Claims by Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2 p-4">
            <h3 className="text-sm font-semibold">Claims by Status</h3>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {stats.statusBreakdown && stats.statusBreakdown.length > 0 ? (
              <div className="flex items-center gap-4">
                <div className="h-48 w-48 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.statusBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="count"
                        nameKey="status"
                      >
                        {stats.statusBreakdown.map((entry) => (
                          <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || "hsl(220, 13%, 50%)"} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "6px",
                          fontSize: "12px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-2">
                  {stats.statusBreakdown.map((entry) => (
                    <div key={entry.status} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[entry.status] || "hsl(220, 13%, 50%)" }} />
                      <span className="text-xs text-muted-foreground">{entry.status}</span>
                      <span className="ml-auto text-xs font-medium">{entry.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                No claims data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Injuries by Month */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2 p-4">
            <h3 className="text-sm font-semibold">Injuries by Month</h3>
            <span className="text-[10px] text-muted-foreground">By date of injury</span>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {stats.workerTypeMonthly && stats.workerTypeMonthly.length > 0 ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.workerTypeMonthly}>
                    <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      labelFormatter={formatMonth}
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                        fontSize: "12px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "10px" }} />
                    <Bar dataKey="w2" stackId="a" fill="#3B5747" name="W2" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="iocc" stackId="a" fill="#EC5A53" name="1099" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                No claims data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Breakdown tables */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="p-4 pb-2">
            <h3 className="text-sm font-semibold">Claims by State</h3>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {stats.byState && stats.byState.length > 0 ? (
              <div className="space-y-1 max-h-56 overflow-y-auto">
                {stats.byState.map((entry) => {
                  const pct = Math.round((entry.count / (stats.totalClaims || 1)) * 100);
                  return (
                    <div key={entry.state} className="flex items-center gap-2 text-xs py-0.5">
                      <span className="font-mono w-7 text-muted-foreground">{entry.state}</span>
                      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary/60 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="font-medium w-10 text-right">{entry.count}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No state data</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <h3 className="text-sm font-semibold">Claims by Injury Type</h3>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {stats.byInjuryType && stats.byInjuryType.length > 0 ? (
              <div className="space-y-1 max-h-56 overflow-y-auto">
                {stats.byInjuryType.map((entry) => {
                  const pct = Math.round((entry.count / (stats.totalClaims || 1)) * 100);
                  return (
                    <div key={entry.type} className="flex items-center gap-2 text-xs py-0.5">
                      <span className="w-36 truncate" title={entry.type}>{entry.type}</span>
                      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-[#C4A27F]/60 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="font-medium w-10 text-right">{entry.count}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No injury type data</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <h3 className="text-sm font-semibold">Claims by Position</h3>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {stats.byPosition && stats.byPosition.length > 0 ? (
              <div className="space-y-1 max-h-56 overflow-y-auto">
                {stats.byPosition.map((entry) => {
                  const pct = Math.round((entry.count / (stats.totalClaims || 1)) * 100);
                  return (
                    <div key={entry.position} className="flex items-center gap-2 text-xs py-0.5">
                      <span className="w-36 truncate" title={entry.position}>{entry.position}</span>
                      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-[#294EB2]/60 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="font-medium w-10 text-right">{entry.count}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No position data</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Repeat Claimants</h3>
              {stats.repeatPros && stats.repeatPros.length > 0 && (
                <span className="text-[10px] text-muted-foreground">{stats.repeatPros.length} pros with multiple claims</span>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {stats.repeatPros && stats.repeatPros.length > 0 ? (
              <div className="space-y-1 max-h-56 overflow-y-auto">
                {stats.repeatPros.map((entry) => (
                  <div key={entry.proId} className="flex items-center gap-2 text-xs py-1 hover:bg-muted/30 rounded px-1">
                    <span className="flex-1 truncate">{entry.name}</span>
                    <span className="text-muted-foreground font-mono text-[10px]">#{entry.proId}</span>
                    <span className="font-medium bg-[#C4A27F]/15 text-[#76614C] dark:bg-[#C4A27F]/20 dark:text-[#E7DACC] px-1.5 py-0.5 rounded text-[10px]">
                      {entry.count} claims
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No repeat claimants</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center">
        <Button variant="outline" size="sm" asChild data-testid="button-view-all-claims">
          <Link href="/claims">
            View All Incidents
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-md" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-md" />
          <Skeleton className="h-72 rounded-md" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 flex-wrap p-6 pb-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight" data-testid="text-dashboard-title">
            Dashboard
          </h1>
        </div>
        <Button asChild size="sm" data-testid="button-new-claim">
          <Link href="/claims/new">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New Incident
          </Link>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
        <div className="px-6 pt-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="financials">Financials</TabsTrigger>
            <TabsTrigger value="risk">Risk Analytics</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="flex-1 overflow-y-auto p-6 pt-4 mt-0">
          {stats ? <OverviewContent stats={stats} /> : null}
        </TabsContent>

        <TabsContent value="financials" className="flex-1 overflow-y-auto p-6 pt-4 mt-0">
          {activeTab === "financials" && <FinancialsContent />}
        </TabsContent>

        <TabsContent value="risk" className="flex-1 overflow-y-auto p-6 pt-4 mt-0">
          {activeTab === "risk" && <RiskAnalyticsContent />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
