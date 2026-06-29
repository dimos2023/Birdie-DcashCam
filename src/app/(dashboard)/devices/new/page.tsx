import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { LinkButton } from "@/components/ui/link-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { createDevice } from "@/lib/actions";

export const metadata = { title: "Register Device" };

export default async function NewDevicePage() {
  const supabase = await createClient();
  const [{ data: models }, { data: vehicles }] = await Promise.all([
    supabase.from("device_models").select("id, name, type").order("name"),
    supabase.from("vehicles").select("id, plate_number").eq("status", "active").order("plate_number"),
  ]);

  return (
    <>
      <PageHeader title="Register Device" description="Add a new Birdie dash cam or GPS device">
        <LinkButton href="/devices" variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </LinkButton>
      </PageHeader>
      <div className="p-6">
        <Card className="max-w-2xl border-0 shadow-sm">
          <CardContent className="pt-6">
            <form action={createDevice} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="serial_number">Serial Number *</Label>
                  <Input id="serial_number" name="serial_number" required placeholder="BD-XXXX-XXXX" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="device_model_id">Device Model</Label>
                  <select
                    id="device_model_id"
                    name="device_model_id"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                  >
                    <option value="">Select model</option>
                    {models?.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.type})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    name="status"
                    defaultValue="inactive"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                  >
                    <option value="inactive">Inactive</option>
                    <option value="active">Active</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="imei">IMEI</Label>
                  <Input id="imei" name="imei" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sim_number">SIM Number</Label>
                  <Input id="sim_number" name="sim_number" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="firmware_version">Firmware Version</Label>
                  <Input id="firmware_version" name="firmware_version" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="vehicle_id">Assign to Vehicle (optional)</Label>
                  <select
                    id="vehicle_id"
                    name="vehicle_id"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                  >
                    <option value="">Unassigned</option>
                    {vehicles?.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.plate_number}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <Button type="submit" className="bg-[#1C3664] hover:bg-[#1C3664]/90">
                Register Device
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
