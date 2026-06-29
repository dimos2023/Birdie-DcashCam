import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VehicleForm } from "@/components/crud/vehicle-form";
import { createClient } from "@/lib/supabase/server";
import { updateVehicle } from "@/app/(dashboard)/vehicles/actions";

export const metadata = { title: "Edit Vehicle" };

export default async function EditVehiclePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: vehicle }, { data: customers }] = await Promise.all([
    supabase.from("vehicles").select("*").eq("id", id).single(),
    supabase.from("customers").select("id, full_name").order("full_name"),
  ]);

  if (!vehicle) notFound();

  const updateWithId = updateVehicle.bind(null, id);

  return (
    <>
      <PageHeader title="Edit Vehicle" description={vehicle.plate_number}>
        <LinkButton href={`/vehicles/${id}`} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to details
        </LinkButton>
      </PageHeader>
      <div className="p-4 md:p-6">
        <Card className="max-w-2xl border border-[#e8f2fa] shadow-sm">
          <CardHeader>
            <CardTitle className="text-[#1C3664]">Update vehicle</CardTitle>
            <CardDescription>Modify vehicle registration and assignment details.</CardDescription>
          </CardHeader>
          <CardContent>
            <VehicleForm
              action={updateWithId}
              vehicle={vehicle}
              customers={customers ?? []}
              error={error ? decodeURIComponent(error) : null}
              submitLabel="Update Vehicle"
              cancelHref={`/vehicles/${id}`}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
