import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VehicleForm } from "@/components/crud/vehicle-form";
import { createClient } from "@/lib/supabase/server";
import { createVehicle } from "@/app/(dashboard)/vehicles/actions";

export const metadata = { title: "New Vehicle" };

export default async function NewVehiclePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
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
          Back to list
        </LinkButton>
      </PageHeader>
      <div className="p-4 md:p-6">
        <Card className="max-w-2xl border border-[#e8f2fa] shadow-sm">
          <CardHeader>
            <CardTitle className="text-[#1C3664]">Vehicle details</CardTitle>
            <CardDescription>
              Link the vehicle to a customer and set its fleet status.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VehicleForm
              action={createVehicle}
              customers={customers ?? []}
              error={error ? decodeURIComponent(error) : null}
              submitLabel="Create Vehicle"
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
