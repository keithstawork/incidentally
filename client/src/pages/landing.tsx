import { useState, useEffect } from "react";
import { Shield, BarChart3, FileSearch, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

interface SplashStats {
  openIncidents: number;
  inLitigation: number;
  totalIncurred: number;
  newThisMonth: number;
}

export default function Landing() {
  const [stats, setStats] = useState<SplashStats | null>(null);

  useEffect(() => {
    fetch("/api/public/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const statCards = stats
    ? [
        { label: "Open Incidents", value: String(stats.openIncidents) },
        { label: "In Litigation", value: String(stats.inLitigation) },
        { label: "Total Incurred", value: formatCurrency(stats.totalIncurred) },
        { label: "New This Month", value: String(stats.newThisMonth) },
      ]
    : null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
              <Shield className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight"><span className="text-foreground">Incident</span><span className="text-primary">ally</span></span>
          </div>
          <Button asChild data-testid="button-login">
            <a href="/api/login">Sign In</a>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 py-20">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
            <div className="flex flex-col gap-6">
              <h1 className="font-serif text-4xl font-bold tracking-tight lg:text-5xl">
                <span className="text-foreground">Claim</span>{" "}
                <span className="text-primary">Management</span>
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Track injury claims from initial intake through resolution.
                Replaces spreadsheets with a purpose-built pipeline that you
                actually want to use.
              </p>
            </div>
            <div className="relative hidden lg:block">
              <div className="rounded-md border bg-card p-6 space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Live Overview
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {statCards
                    ? statCards.map((stat) => (
                        <div
                          key={stat.label}
                          className="rounded-md border border-card-border bg-background p-3"
                        >
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {stat.label}
                          </p>
                          <p className="text-xl font-semibold">{stat.value}</p>
                        </div>
                      ))
                    : Array.from({ length: 4 }).map((_, i) => (
                        <div
                          key={i}
                          className="rounded-md border border-card-border bg-background p-3 space-y-2"
                        >
                          <Skeleton className="h-3 w-20" />
                          <Skeleton className="h-6 w-12" />
                        </div>
                      ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t bg-card/50">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  icon: FileSearch,
                  title: "Full Claim Pipeline",
                  description:
                    "Track claims from injury intake through active management, litigation, settlement, and closure.",
                },
                {
                  icon: Users,
                  title: "Role-Based Access",
                  description:
                    "Trust & Safety handles intake. Legal manages active claims. Everyone sees what they need.",
                },
                {
                  icon: BarChart3,
                  title: "Actionable Insights",
                  description:
                    "Dashboard with real-time stats, financial summaries, and overdue action items at a glance.",
                },
              ].map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-md border bg-background p-5 space-y-2 hover-elevate"
                >
                  <feature.icon className="h-5 w-5 text-primary" />
                  <h3 className="text-sm font-semibold">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-6">
        <div className="mx-auto max-w-6xl px-4 text-center text-xs text-muted-foreground">
          Instawork Incidentally &mdash; Claim Management
        </div>
      </footer>
    </div>
  );
}
