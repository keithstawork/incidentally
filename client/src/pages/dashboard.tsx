import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  FileText,
  AlertTriangle,
  Scale,
  TrendingUp,
  Clock,
  Plus,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "recharts";

interface DashboardStats {
  totalOpen: number;
  newThisWeek: number;
  totalIncurred: number;
  inLitigation: number;
  pendingAction: number;
  statusBreakdown: { status: string; count: number }[];
  monthlyBreakdown: { month: string; count: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  Open: "hsl(45, 93%, 47%)",
  Closed: "hsl(142, 71%, 45%)",
  Denied: "hsl(0, 72%, 50%)",
  "Incident Only": "hsl(220, 13%, 60%)",
  "Not reported/Incident only 1099": "hsl(220, 13%, 75%)",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(m) - 1]} ${year.slice(2)}`;
}

export default function Dashboard() {
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
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

  const statCards = [
    {
      label: "Open Claims",
      value: stats?.totalOpen ?? 0,
      icon: FileText,
      color: "text-yellow-600",
    },
    {
      label: "New This Week",
      value: stats?.newThisWeek ?? 0,
      icon: Clock,
      color: "text-blue-600",
    },
    {
      label: "Total Incurred",
      value: formatCurrency(stats?.totalIncurred ?? 0),
      icon: TrendingUp,
      color: "text-emerald-600",
    },
    {
      label: "In Litigation",
      value: stats?.inLitigation ?? 0,
      icon: Scale,
      color: "text-red-600",
    },
    {
      label: "Pending Action",
      value: stats?.pendingAction ?? 0,
      icon: AlertTriangle,
      color: "text-orange-600",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold tracking-tight" data-testid="text-dashboard-title">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Workers' compensation claims overview
          </p>
        </div>
        <Button asChild size="sm" data-testid="button-new-claim">
          <Link href="/claims/new">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New Claim
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
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
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2 p-4">
            <h3 className="text-sm font-semibold">Claims by Status</h3>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {stats?.statusBreakdown && stats.statusBreakdown.length > 0 ? (
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
                          <Cell
                            key={entry.status}
                            fill={STATUS_COLORS[entry.status] || "hsl(220, 13%, 50%)"}
                          />
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
                      <span
                        className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: STATUS_COLORS[entry.status] || "hsl(220, 13%, 50%)" }}
                      />
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2 p-4">
            <h3 className="text-sm font-semibold">Claims by Month</h3>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {stats?.monthlyBreakdown && stats.monthlyBreakdown.length > 0 ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.monthlyBreakdown}>
                    <XAxis
                      dataKey="month"
                      tickFormatter={formatMonth}
                      tick={{ fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      labelFormatter={formatMonth}
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                        fontSize: "12px",
                      }}
                    />
                    <Bar
                      dataKey="count"
                      fill="hsl(var(--primary))"
                      radius={[3, 3, 0, 0]}
                      name="Claims"
                    />
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

      <div className="flex justify-center">
        <Button variant="outline" size="sm" asChild data-testid="button-view-all-claims">
          <Link href="/claims">
            View All Claims
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
