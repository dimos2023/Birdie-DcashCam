import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DeviceForm } from "@/components/crud/device-form";
import { createClient } from "@/lib/supabase/server";
import { createDevice } from "@/app/(dashboard)/devices/actions";

export const metadata = { title: "Register Device" };

export default async function NewDevicePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: models, error: modelsError } = await supabase
    .from("device_models")
    .select("id, name, category")
    .order("name");

  if (modelsError) {
    console.error("Load device models failed:", modelsError);
  }

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
              Enter hardware details, warranty dates, and activation information.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {modelsError && (
              <Alert variant="destructive">
                <AlertDescription>
                  Could not load device models: {modelsError.message}. You can still save a device
                  without selecting a model.
                </AlertDescription>
              </Alert>
            )}
            <DeviceForm
              action={createDevice}
              models={models ?? []}
              error={error ? decodeURIComponent(error) : null}
              submitLabel="Create Device"
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
