import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomerForm } from "@/components/crud/customer-form";
import { createClient } from "@/lib/supabase/server";
import { updateCustomer } from "@/app/(dashboard)/customers/actions";

export const metadata = { title: "Edit Customer" };

export default async function EditCustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .single();

  if (!customer) notFound();

  const updateWithId = updateCustomer.bind(null, id);

  return (
    <>
      <PageHeader title="Edit Customer" description={customer.name ?? "Customer"}>
        <LinkButton href={`/customers/${id}`} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to details
        </LinkButton>
      </PageHeader>
      <div className="p-4 md:p-6">
        <Card className="max-w-2xl border border-[#e8f2fa] shadow-sm">
          <CardHeader>
            <CardTitle className="text-[#1C3664]">Update customer</CardTitle>
            <CardDescription>Modify contact information and consent status.</CardDescription>
          </CardHeader>
          <CardContent>
            <CustomerForm
              action={updateWithId}
              customer={customer}
              error={error ? decodeURIComponent(error) : null}
              submitLabel="Update Customer"
              cancelHref={`/customers/${id}`}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
