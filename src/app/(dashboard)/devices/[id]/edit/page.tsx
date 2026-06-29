import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DeviceForm } from "@/components/crud/device-form";
import { createClient } from "@/lib/supabase/server";
import { updateDevice } from "@/app/(dashboard)/devices/actions";

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

  const [{ data: device }, { data: models }] = await Promise.all([
    supabase.from("devices").select("*").eq("id", id).single(),
    supabase.from("device_models").select("id, name, type").order("name"),
  ]);

  if (!device) notFound();

  const updateWithId = updateDevice.bind(null, id);

  return (
    <>
      <PageHeader title="Edit Device" description={device.serial_number}>
        <LinkButton href={`/devices/${id}`} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to details
        </LinkButton>
      </PageHeader>
      <div className="p-4 md:p-6">
        <Card className="max-w-2xl border border-[#e8f2fa] shadow-sm">
          <CardHeader>
            <CardTitle className="text-[#1C3664]">Update device</CardTitle>
            <CardDescription>Modify hardware details, status, and warranty dates.</CardDescription>
          </CardHeader>
          <CardContent>
            <DeviceForm
              action={updateWithId}
              device={device}
              models={models ?? []}
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
