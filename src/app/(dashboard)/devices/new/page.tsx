import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DeviceForm } from "@/components/crud/device-form";
import { createClient } from "@/lib/supabase/server";
import { createDevice } from "@/app/(dashboard)/devices/actions";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/constants/organization";

export const metadata = { title: "Register Device" };

export default async function NewDevicePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const [modelsRes, customersRes, vehiclesRes] = await Promise.all([
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
  ]);

  if (modelsRes.error) console.error("Load device models failed:", modelsRes.error);
  if (customersRes.error) console.error("Load customers failed:", customersRes.error);
  if (vehiclesRes.error) console.error("Load vehicles failed:", vehiclesRes.error);

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

  return (
    <>
      <PageHeader title="Register Device" description="Add a new Birdie dash cam or GPS device">
        <LinkButton href="/devices" variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to list
        </LinkButton>
      </PageHeader>
      <div className="p-4 md:p-6">
        <Card className="max-w-2xl border border-[#e8f2fa] shadow-sm">
          <CardHeader>
            <CardTitle className="text-[#1C3664]">Device registration</CardTitle>
            <CardDescription>
              Assign the device to a customer, optionally link a vehicle, and enter hardware
              details.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {modelsRes.error && (
              <Alert variant="destructive">
                <AlertDescription>
                  Could not load device models: {modelsRes.error.message}. You can still save a
                  device without selecting a model.
                </AlertDescription>
              </Alert>
            )}
            {customersRes.error && (
              <Alert variant="destructive">
                <AlertDescription>
                  Could not load customers: {customersRes.error.message}
                </AlertDescription>
              </Alert>
            )}
            {vehiclesRes.error && (
              <Alert variant="destructive">
                <AlertDescription>
                  Could not load vehicles: {vehiclesRes.error.message}
                </AlertDescription>
              </Alert>
            )}
            <DeviceForm
              action={createDevice}
              models={modelsRes.data ?? []}
              customers={customersRes.data ?? []}
              vehicles={vehicles}
              error={error ? decodeURIComponent(error) : null}
              submitLabel="Create Device"
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
