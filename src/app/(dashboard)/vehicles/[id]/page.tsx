import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Pencil, Radio } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DeleteConfirmButton } from "@/components/ui/delete-confirm-button";
import { createClient } from "@/lib/supabase/server";
import { deleteVehicle } from "@/app/(dashboard)/vehicles/actions";

export const metadata = { title: "Vehicle Details" };

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: vehicle }, { data: assignments }] = await Promise.all([
    supabase.from("vehicles").select("*, customers(name)").eq("id", id).single(),
    supabase
      .from("vehicle_devices")
      .select("*, devices(serial_number, status, device_models(name))")
      .eq("vehicle_id", id)
      .is("unassigned_at", null),
  ]);

  if (!vehicle) notFound();

  const customerName = (vehicle as { customers?: { name: string } }).customers?.name;

  return (
    <>
      <PageHeader title={vehicle.plate_number} description="Vehicle details and device assignments">
        <div className="flex flex-wrap gap-2">
          <LinkButton href="/vehicles" variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </LinkButton>
          <LinkButton href={`/vehicles/${id}/edit`}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </LinkButton>
          <LinkButton href={`/vehicles/${id}/live`} className="bg-[#3B8ECC] hover:bg-[#3B8ECC]/90">
            <Radio className="mr-2 h-4 w-4" />
            Live View
          </LinkButton>
          <DeleteConfirmButton
            id={id}
            confirmMessage="Are you sure you want to delete this vehicle?"
            deleteAction={deleteVehicle}
            redirectTo="/vehicles"
          />
        </div>
      </PageHeader>

      <div className="grid gap-6 p-4 md:p-6 lg:grid-cols-3">
        <Card className="border border-[#e8f2fa] shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-[#1C3664]">Vehicle information</CardTitle>
            <CardDescription>View vehicle registration and status details.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              {[
                ["Plate Number", vehicle.plate_number],
                ["Customer", customerName],
                ["Brand", vehicle.make],
                ["Model", vehicle.model],
                ["Year", vehicle.year?.toString()],
                ["Color", vehicle.color],
                ["Status", vehicle.status],
                ["Created", format(new Date(vehicle.created_at), "dd MMM yyyy")],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-medium uppercase tracking-wide text-[#1C1C1C]/45">
                    {label}
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-[#1C3664]">{value ?? "—"}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card className="border border-[#e8f2fa] shadow-sm">
          <CardHeader>
            <CardTitle className="text-base text-[#1C3664]">Assigned Devices</CardTitle>
          </CardHeader>
          <CardContent>
            {!assignments?.length ? (
              <p className="text-sm text-muted-foreground">No devices assigned to this vehicle.</p>
            ) : (
              <div className="space-y-3">
                {assignments.map((a) => {
                  const device = (a as {
                    devices?: { serial_number: string; status: string; device_models?: { name: string } };
                  }).devices;
                  return (
                    <div key={a.id} className="rounded-xl border border-[#e8f2fa] p-3">
                      <p className="text-sm font-medium text-[#1C3664]">{device?.serial_number}</p>
                      <p className="text-xs text-muted-foreground">{device?.device_models?.name}</p>
                      <Badge variant="outline" className="mt-2">
                        {device?.status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
