import Link from "next/link";
import { format } from "date-fns";
import { Car, Cpu, Users, Activity, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/session";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  if (!profile) return null;

  const orgId = profile.organization_id;

  const [
    { count: customersCount },
    { count: vehiclesCount },
    { count: devicesCount },
    { count: activeDevicesCount },
    { data: recentLogs },
    { data: recentVehicles },
  ] = await Promise.all([
    supabase.from("customers").select("*", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("vehicles").select("*", { count: "exact", head: true }),
    supabase.from("devices").select("*", { count: "exact", head: true }),
    supabase.from("devices").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase
      .from("audit_logs")
      .select("*, profiles(full_name)")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("vehicles")
      .select("*, customers(name)")
      .eq("organization_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(5),
  ]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${profile.full_name}`}
      />
      <div className="space-y-6 p-4 md:p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Customers" value={customersCount ?? 0} icon={Users} description="Active accounts" />
          <StatCard title="Vehicles" value={vehiclesCount ?? 0} icon={Car} description="Fleet units" />
          <StatCard title="Devices" value={devicesCount ?? 0} icon={Cpu} description="Registered hardware" />
          <StatCard
            title="Online Devices"
            value={activeDevicesCount ?? 0}
            icon={Activity}
            trend={`${devicesCount ? Math.round(((activeDevicesCount ?? 0) / devicesCount) * 100) : 0}%`}
            description="active rate"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-[#1C3664]">Recent Vehicles</CardTitle>
              <LinkButton href="/vehicles" variant="ghost" size="sm">
                View all <ArrowRight className="ml-1 h-4 w-4" />
              </LinkButton>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentVehicles?.length === 0 && (
                  <p className="text-sm text-muted-foreground">No vehicles yet</p>
                )}
                {recentVehicles?.map((vehicle) => (
                  <Link
                    key={vehicle.id}
                    href={`/vehicles/${vehicle.id}/live`}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-[#F2F8FC]"
                  >
                    <div>
                      <p className="font-medium text-[#1C3664]">{vehicle.plate_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {(vehicle as { customers?: { name: string } }).customers?.name ?? "No customer"}
                      </p>
                    </div>
                    <Badge variant="outline">{vehicle.status}</Badge>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-[#1C3664]">Audit Log</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentLogs?.length === 0 && (
                  <p className="text-sm text-muted-foreground">No activity yet</p>
                )}
                {recentLogs?.map((log) => (
                  <div key={log.id} className="flex items-start justify-between border-b pb-3 last:border-0">
                    <div>
                      <p className="text-sm font-medium capitalize">
                        {log.action} {log.entity_type}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(log as { profiles?: { full_name: string } }).profiles?.full_name ?? "System"}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(log.created_at), "MMM d, HH:mm")}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
