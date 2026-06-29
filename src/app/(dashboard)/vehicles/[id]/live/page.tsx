import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { LinkButton } from "@/components/ui/link-button";
import { createClient } from "@/lib/supabase/server";
import type { WhatsappMessage } from "@/lib/types";
import { LiveVehicleView } from "@/components/live/live-vehicle-view";

export const metadata = { title: "Live Vehicle" };

export default async function LiveVehiclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("*, customers(name, phone)")
    .eq("id", id)
    .single();

  if (!vehicle) notFound();

  const customer = vehicle.customers as { name: string; phone: string | null } | null;

  const [
    { data: locations },
    { data: streams },
    { data: conversation },
    { data: assignments },
  ] = await Promise.all([
    supabase
      .from("vehicle_locations")
      .select("*")
      .eq("vehicle_id", id)
      .order("recorded_at", { ascending: false })
      .limit(500),
    supabase.from("camera_streams").select("*").eq("vehicle_id", id),
    supabase
      .from("whatsapp_conversations")
      .select("*")
      .eq("vehicle_id", id)
      .eq("is_active", true)
      .maybeSingle(),
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
  const deviceType = device?.device_models?.type ?? null;
  const deviceSerial = device?.serial_number ?? null;

  const history = [...(locations ?? [])].reverse();
  const initialLocation = locations?.[0] ?? null;

  let messages: WhatsappMessage[] = [];
  if (conversation) {
    const { data } = await supabase
      .from("whatsapp_messages")
      .select("*")
      .eq("conversation_id", conversation.id)
      .order("sent_at", { ascending: true })
      .limit(100);
    messages = data ?? [];
  }

  return (
    <>
      <PageHeader
        title="Live Monitoring"
        description={`Real-time tracking for ${vehicle.plate_number}`}
      >
        <LinkButton href={`/vehicles/${id}`} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Vehicle Details
        </LinkButton>
      </PageHeader>
      <LiveVehicleView
        vehicle={vehicle}
        initialLocation={initialLocation}
        history={history}
        streams={streams ?? []}
        conversation={conversation}
        messages={messages}
        customerName={customer?.name ?? null}
        customerPhone={customer?.phone ?? conversation?.wa_phone_number ?? null}
        deviceSerial={deviceSerial}
        deviceType={deviceType}
      />
    </>
  );
}
