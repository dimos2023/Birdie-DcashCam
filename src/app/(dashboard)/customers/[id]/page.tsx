import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Pencil } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DeleteConfirmButton } from "@/components/ui/delete-confirm-button";
import { createClient } from "@/lib/supabase/server";
import { deleteCustomer } from "@/app/(dashboard)/customers/actions";

export const metadata = { title: "Customer Details" };

function displayName(name: string | null | undefined) {
  return name?.trim() ? name : "Unnamed Customer";
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .single();

  if (!customer) notFound();

  return (
    <>
      <PageHeader
        title={displayName(customer.name)}
        description="Customer profile and contact details"
      >
        <div className="flex flex-wrap gap-2">
          <LinkButton href="/customers" variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </LinkButton>
          <LinkButton href={`/customers/${id}/edit`}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </LinkButton>
          <DeleteConfirmButton
            id={id}
            confirmMessage="Are you sure you want to delete this customer?"
            deleteAction={deleteCustomer}
            redirectTo="/customers"
          />
        </div>
      </PageHeader>

      <div className="grid gap-6 p-4 md:p-6 lg:grid-cols-3">
        <Card className="border border-[#e8f2fa] shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-[#1C3664]">Customer information</CardTitle>
            <CardDescription>View customer contact details and consent status.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              {[
                ["Full Name", displayName(customer.name)],
                ["Phone", customer.phone],
                ["WhatsApp", customer.whatsapp_number],
                ["Email", customer.email],
                ["City", customer.city],
                ["Consent", customer.consent_status ?? "pending"],
                ["Created", format(new Date(customer.created_at), "dd MMM yyyy")],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-medium uppercase tracking-wide text-[#1C1C1C]/45">
                    {label}
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-[#1C3664]">{value ?? "—"}</dd>
                </div>
              ))}
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-[#1C1C1C]/45">
                  Notes
                </dt>
                <dd className="mt-1 text-sm text-[#1C1C1C]/70">{customer.notes ?? "—"}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="border border-[#e8f2fa] shadow-sm">
          <CardHeader>
            <CardTitle className="text-base text-[#1C3664]">Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Badge variant={customer.is_active ? "default" : "secondary"}>
              {customer.is_active ? "Active" : "Inactive"}
            </Badge>
            <p className="text-xs text-muted-foreground">
              Last updated {format(new Date(customer.updated_at), "dd MMM yyyy, HH:mm")}
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
