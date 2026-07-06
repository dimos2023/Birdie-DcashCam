import { PageHeader } from "@/components/layout/page-header";
import { Gps51FleetMonitor } from "@/components/gps51/gps51-fleet-monitor";
import { requireProfile } from "@/lib/auth/profile";
import { getGps51LiveDevices } from "@/lib/gps51/queries";

export const metadata = {
  title: "GPS51 Devices",
  description: "GPS51 synchronized fleet inventory and live positions",
};

export default async function Gps51DevicesPage() {
  const profile = await requireProfile();
  const { devices, error } = await getGps51LiveDevices(profile.organization_id);

  return (
    <>
      <PageHeader
        title="GPS51 Devices"
        description="Synchronized GPS51 fleet inventory with live WebSocket positions"
      />
      <div className="space-y-4 p-4 md:p-6">
        <Gps51FleetMonitor
          initialDevices={devices}
          organizationId={profile.organization_id}
          initialError={error}
        />
      </div>
    </>
  );
}
