import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Radio } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { LinkButton } from "@/components/ui/link-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { updateVehicle } from "@/lib/actions";

export const metadata = { title: "Vehicle Details" };

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: vehicle }, { data: customers }, { data: assignments }] = await Promise.all([
    supabase.from("vehicles").select("*").eq("id", id).single(),
    supabase.from("customers").select("id, name").eq("is_active", true).order("name"),
    supabase
      .from("vehicle_devices")
      .select("*, devices(serial_number, status, device_models(name))")
      .eq("vehicle_id", id)
      .is("unassigned_at", null),
  ]);

  if (!vehicle) notFound();

  const updateWithId = updateVehicle.bind(null, id);

  return (
    <>
      <PageHeader title={vehicle.plate_number} description="Vehicle details and device assignments">
        <div className="flex gap-2">
          <LinkButton href="/vehicles" variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </LinkButton>
          <LinkButton href={`/vehicles/${id}/live`} className="bg-[#3B8ECC] hover:bg-[#3B8ECC]/90">
            <Radio className="mr-2 h-4 w-4" />
            Live View
          </LinkButton>
        </div>
      </PageHeader>
      <div className="grid gap-6 p-6 lg:grid-cols-3">
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardContent className="pt-6">
            <form action={updateWithId} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="plate_number">Plate Number *</Label>
                  <Input id="plate_number" name="plate_number" defaultValue={vehicle.plate_number} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer_id">Customer</Label>
                  <select
                    id="customer_id"
                    name="customer_id"
                    defaultValue={vehicle.customer_id ?? ""}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                  >
                    <option value="">No customer</option>
                    {customers?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="make">Make</Label>
                  <Input id="make" name="make" defaultValue={vehicle.make ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Input id="model" name="model" defaultValue={vehicle.model ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year">Year</Label>
                  <Input id="year" name="year" type="number" defaultValue={vehicle.year ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="color">Color</Label>
                  <Input id="color" name="color" defaultValue={vehicle.color ?? ""} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="vin">VIN</Label>
                  <Input id="vin" name="vin" defaultValue={vehicle.vin ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    name="status"
                    defaultValue={vehicle.status}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" name="notes" rows={3} defaultValue={vehicle.notes ?? ""} />
                </div>
              </div>
              <Button type="submit" className="bg-[#1C3664] hover:bg-[#1C3664]/90">
                Save Changes
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-[#1C3664]">Assigned Devices</CardTitle>
          </CardHeader>
          <CardContent>
            {assignments?.length === 0 ? (
              <p className="text-sm text-muted-foreground">No devices assigned</p>
            ) : (
              <div className="space-y-3">
                {assignments?.map((a) => {
                  const device = (a as { devices?: { serial_number: string; status: string; device_models?: { name: string } } }).devices;
                  return (
                    <div key={a.id} className="rounded-lg border p-3">
                      <p className="font-medium text-sm">{device?.serial_number}</p>
                      <p className="text-xs text-muted-foreground">{device?.device_models?.name}</p>
                      <Badge variant="outline" className="mt-2">{device?.status}</Badge>
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
