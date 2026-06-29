import Link from "next/link";
import { Radio } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Live Monitoring" };

export default async function LiveMonitoringPage() {
  const supabase = await createClient();
  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, plate_number, brand, model, status")
    .eq("status", "active")
    .order("plate_number")
    .limit(20);

  return (
    <>
      <PageHeader
        title="Live Monitoring"
        description="Select a vehicle to view real-time GPS, cameras, and telemetry"
      />
      <div className="grid gap-4 p-4 md:grid-cols-2 md:p-6 lg:grid-cols-3">
        {vehicles?.length === 0 && (
          <Card className="col-span-full border-0 shadow-sm">
            <CardContent className="py-12 text-center text-muted-foreground">
              No active vehicles available for live monitoring.
            </CardContent>
          </Card>
        )}
        {vehicles?.map((vehicle) => (
          <Card key={vehicle.id} className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-[#1C3664]">{vehicle.plate_number}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {[vehicle.brand, vehicle.model].filter(Boolean).join(" ") || "—"}
              </p>
            </CardHeader>
            <CardContent>
              <LinkButton
                href={`/vehicles/${vehicle.id}/live`}
                className="w-full bg-[#3B8ECC] hover:bg-[#3B8ECC]/90"
              >
                <Radio className="mr-2 h-4 w-4" />
                Open Live View
              </LinkButton>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
