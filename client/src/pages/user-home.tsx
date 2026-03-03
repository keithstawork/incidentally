import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Plus,
  BarChart3,
  Clock,
  ArrowRight,
} from "lucide-react";

export default function UserHome() {
  const { user } = useAuth();

  const firstName = user?.firstName || "there";

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-5xl mx-auto p-6 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back, {firstName}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            What would you like to do today?
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link href="/claims">
            <Card className="cursor-pointer hover:shadow-md transition-shadow group">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#3B5747]/10">
                    <FileText className="h-4 w-4 text-[#3B5747]" />
                  </div>
                  <CardTitle className="text-sm font-medium">All Incidents</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  View and manage all open and closed incidents
                </p>
                <ArrowRight className="h-4 w-4 text-muted-foreground mt-3 group-hover:translate-x-1 transition-transform" />
              </CardContent>
            </Card>
          </Link>

          <Link href="/claims/new">
            <Card className="cursor-pointer hover:shadow-md transition-shadow group">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2E5A88]/10">
                    <Plus className="h-4 w-4 text-[#2E5A88]" />
                  </div>
                  <CardTitle className="text-sm font-medium">New Incident</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Report and file a new workers' compensation incident
                </p>
                <ArrowRight className="h-4 w-4 text-muted-foreground mt-3 group-hover:translate-x-1 transition-transform" />
              </CardContent>
            </Card>
          </Link>

          <Link href="/insights">
            <Card className="cursor-pointer hover:shadow-md transition-shadow group">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#D4A017]/10">
                    <BarChart3 className="h-4 w-4 text-[#D4A017]" />
                  </div>
                  <CardTitle className="text-sm font-medium">Data Insights</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Dashboard, financials, and risk analytics
                </p>
                <ArrowRight className="h-4 w-4 text-muted-foreground mt-3 group-hover:translate-x-1 transition-transform" />
              </CardContent>
            </Card>
          </Link>
        </div>

        <Card className="border-dashed">
          <CardContent className="flex items-center gap-3 py-6">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Recent activity and user permissions coming soon</p>
              <p className="text-xs text-muted-foreground">
                This page will be personalized based on your role and recent work.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
