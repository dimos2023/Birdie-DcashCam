import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { LiveVehicleView } from "@/components/live/live-vehicle-view";
import {
  getPlaceholderCurrentLocation,
  getPlaceholderLocations,
  getPlaceholderWhatsappMessages,
} from "@/lib/live/placeholders";

export const metadata = { title: "Live Vehicle" };

export default async function LiveVehiclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("*, customers(name, phone, whatsapp_number)")
    .eq("id", id)
    .single();

  if (!vehicle) notFound();

  const customer = vehicle.customers as {
    name: string;
    phone: string | null;
    whatsapp_number?: string | null;
  } | null;

  const [{ data: dbLocations }, { data: assignments }] = await Promise.all([
    supabase
      .from("vehicle_locations")
      .select("*")
      .eq("vehicle_id", id)
      .order("recorded_at", { ascending: false })
      .limit(500),
    supabase
      .from("vehicle_devices")
      .select("*, devices(serial_number, device_models(type, name))")
      .eq("vehicle_id", id)
      .is("unassigned_at", null)
      .order("is_primary", { ascending: false })
      .limit(1),
  ]);

  const primaryAssignment = assignments?.[0] as
    | {
        devices?: {
          serial_number: string;
          device_models?: { type: "dash_cam" | "gps_tracker" | "combo"; name: string };
        };
      }
    | undefined;

  const device = primaryAssignment?.devices;
  const deviceType = device?.device_models?.type ?? "combo";
  const deviceSerial = device?.serial_number ?? "BD-DEMO-0001";

  const orgId = profile?.organization_id ?? vehicle.organization_id;
  const useDemo = !dbLocations?.length;

  const history = useDemo
    ? getPlaceholderLocations(id, orgId)
    : [...(dbLocations ?? [])].reverse();

  const currentLocation = useDemo
    ? getPlaceholderCurrentLocation(id, orgId)
    : (dbLocations?.[0] ?? null);

  const messages = getPlaceholderWhatsappMessages(orgId, `demo-conv-${id}`);

  const customerPhone =
    customer?.whatsapp_number ?? customer?.phone ?? "+966 5X XXX XXXX";

  return (
    <div className="min-h-full bg-[#F2F8FC]">
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-[#e8f2fa] bg-white/95 px-4 py-3 backdrop-blur-sm md:px-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#3B8ECC]">
            Live Monitoring
          </p>
          <p className="text-lg font-bold text-[#1C3664]">{vehicle.plate_number}</p>
        </div>
        <LinkButton href={`/vehicles/${id}`} variant="outline" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Vehicle Details
        </LinkButton>
      </div>

      <LiveVehicleView
        vehicle={vehicle}
        history={history}
        currentLocation={currentLocation}
        messages={messages}
        customerName={customer?.name ?? null}
        customerPhone={customerPhone}
        deviceSerial={deviceSerial}
        deviceType={deviceType}
        isDemo={useDemo}
      />
    </div>
  );
}
