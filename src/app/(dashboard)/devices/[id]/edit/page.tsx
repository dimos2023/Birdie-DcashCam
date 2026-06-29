import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DeviceForm } from "@/components/crud/device-form";
import { createClient } from "@/lib/supabase/server";
import { updateDevice } from "@/app/(dashboard)/devices/actions";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/constants/organization";

export const metadata = { title: "Edit Device" };

export default async function EditDevicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const [deviceRes, modelsRes, customersRes, vehiclesRes, assignmentRes] = await Promise.all([
    supabase.from("devices").select("*").eq("id", id).single(),
    supabase.from("device_models").select("id, name, category").order("name"),
    supabase
      .from("customers")
      .select("id, full_name, phone, whatsapp_number")
      .eq("organization_id", DEFAULT_ORGANIZATION_ID)
      .order("full_name"),
    supabase
      .from("vehicles")
      .select("id, customer_id, plate_number, brand, customers(full_name)")
      .eq("organization_id", DEFAULT_ORGANIZATION_ID)
      .order("plate_number"),
    supabase
      .from("vehicle_devices")
      .select("vehicle_id")
      .eq("device_id", id)
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  if (!deviceRes.data) notFound();

  if (modelsRes.error) console.error("Load device models failed:", modelsRes.error);
  if (customersRes.error) console.error("Load customers failed:", customersRes.error);
  if (vehiclesRes.error) console.error("Load vehicles failed:", vehiclesRes.error);
  if (assignmentRes.error) console.error("Load device assignment failed:", assignmentRes.error);

  const vehicles = (vehiclesRes.data ?? []).map((vehicle) => {
    const customer = vehicle.customers as { full_name: string } | null;
    return {
      id: vehicle.id,
      customer_id: vehicle.customer_id,
      plate_number: vehicle.plate_number,
      brand: vehicle.brand,
      customer_name: customer?.full_name ?? "Unnamed Customer",
    };
  });

  const updateWithId = updateDevice.bind(null, id);

  return (
    <>
      <PageHeader title="Edit Device" description={deviceRes.data.serial_number}>
        <LinkButton href={`/devices/${id}`} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to details
        </LinkButton>
      </PageHeader>
      <div className="p-4 md:p-6">
        <Card className="max-w-2xl border border-[#e8f2fa] shadow-sm">
          <CardHeader>
            <CardTitle className="text-[#1C3664]">Update device</CardTitle>
            <CardDescription>
              Change customer ownership, vehicle assignment, hardware details, and warranty dates.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {assignmentRes.error && (
              <Alert variant="destructive">
                <AlertDescription>
                  Could not load current vehicle assignment: {assignmentRes.error.message}
                </AlertDescription>
              </Alert>
            )}
            <DeviceForm
              action={updateWithId}
              device={deviceRes.data}
              models={modelsRes.data ?? []}
              customers={customersRes.data ?? []}
              vehicles={vehicles}
              defaultVehicleId={assignmentRes.data?.vehicle_id ?? null}
              error={error ? decodeURIComponent(error) : null}
              submitLabel="Update Device"
              cancelHref={`/devices/${id}`}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
