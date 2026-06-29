import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Pencil } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DeleteConfirmButton } from "@/components/ui/delete-confirm-button";
import { createClient } from "@/lib/supabase/server";
import { deleteDevice } from "@/app/(dashboard)/devices/actions";

export const metadata = { title: "Device Details" };

export default async function DeviceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: device }, { data: assignment }] = await Promise.all([
    supabase.from("devices").select("*, device_models(name, type)").eq("id", id).single(),
    supabase
      .from("vehicle_devices")
      .select("*, vehicles(plate_number)")
      .eq("device_id", id)
      .is("unassigned_at", null)
      .maybeSingle(),
  ]);

  if (!device) notFound();

  const model = (device as { device_models?: { name: string; type: string } }).device_models;
  const vehicle = (assignment as { vehicles?: { plate_number: string } } | null)?.vehicles;

  return (
    <>
      <PageHeader title={device.serial_number} description="Device hardware and warranty details">
        <div className="flex flex-wrap gap-2">
          <LinkButton href="/devices" variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </LinkButton>
          <LinkButton href={`/devices/${id}/edit`}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </LinkButton>
          <DeleteConfirmButton
            id={id}
            confirmMessage="Are you sure you want to delete this device?"
            deleteAction={deleteDevice}
            redirectTo="/devices"
          />
        </div>
      </PageHeader>

      <div className="grid gap-6 p-4 md:p-6 lg:grid-cols-3">
        <Card className="border border-[#e8f2fa] shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-[#1C3664]">Device information</CardTitle>
            <CardDescription>View device hardware, status, and warranty details.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              {[
                ["Serial Number", device.serial_number],
                ["Model", model ? `${model.name} (${model.type.replace("_", " ")})` : null],
                ["IMEI", device.imei],
                ["SIM Number", device.sim_number],
                ["Status", device.status],
                [
                  "Activation Date",
                  device.activation_date
                    ? format(new Date(device.activation_date), "dd MMM yyyy")
                    : null,
                ],
                [
                  "Warranty Start",
                  device.warranty_start
                    ? format(new Date(device.warranty_start), "dd MMM yyyy")
                    : null,
                ],
                [
                  "Warranty End",
                  device.warranty_end
                    ? format(new Date(device.warranty_end), "dd MMM yyyy")
                    : null,
                ],
                [
                  "Last Seen",
                  device.last_seen_at
                    ? format(new Date(device.last_seen_at), "dd MMM yyyy, HH:mm")
                    : "Never",
                ],
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
            <CardTitle className="text-base text-[#1C3664]">Assignment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {vehicle ? (
              <>
                <p className="text-sm text-muted-foreground">Assigned to vehicle</p>
                <Badge className="text-sm">{vehicle.plate_number}</Badge>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Not assigned to any vehicle.</p>
            )}
            <p className="text-xs text-muted-foreground">
              Registered {format(new Date(device.created_at), "dd MMM yyyy")}
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
