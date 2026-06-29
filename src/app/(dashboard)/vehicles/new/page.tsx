import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { LinkButton } from "@/components/ui/link-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { createVehicle } from "@/lib/actions";

export const metadata = { title: "New Vehicle" };

export default async function NewVehiclePage() {
  const supabase = await createClient();
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  return (
    <>
      <PageHeader title="New Vehicle" description="Register a fleet vehicle">
        <LinkButton href="/vehicles" variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </LinkButton>
      </PageHeader>
      <div className="p-6">
        <Card className="max-w-2xl border-0 shadow-sm">
          <CardContent className="pt-6">
            <form action={createVehicle} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="plate_number">Plate Number *</Label>
                  <Input id="plate_number" name="plate_number" required placeholder="ABC 1234" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer_id">Customer</Label>
                  <select
                    id="customer_id"
                    name="customer_id"
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
                  <Input id="make" name="make" placeholder="Toyota" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Input id="model" name="model" placeholder="Hilux" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year">Year</Label>
                  <Input id="year" name="year" type="number" min="1990" max="2030" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="color">Color</Label>
                  <Input id="color" name="color" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="vin">VIN</Label>
                  <Input id="vin" name="vin" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    name="status"
                    defaultValue="active"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" name="notes" rows={3} />
                </div>
              </div>
              <Button type="submit" className="bg-[#1C3664] hover:bg-[#1C3664]/90">
                Create Vehicle
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
