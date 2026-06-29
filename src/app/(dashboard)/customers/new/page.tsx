import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomerForm } from "@/components/crud/customer-form";
import { createCustomer } from "@/lib/actions";

export const metadata = { title: "New Customer" };

export default async function NewCustomerPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <>
      <PageHeader title="New Customer" description="Add a new fleet customer">
        <LinkButton href="/customers" variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to list
        </LinkButton>
      </PageHeader>
      <div className="p-4 md:p-6">
        <Card className="max-w-2xl border border-[#e8f2fa] shadow-sm">
          <CardHeader>
            <CardTitle className="text-[#1C3664]">Customer details</CardTitle>
            <CardDescription>
              Enter contact information and consent status for the new customer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CustomerForm
              action={createCustomer}
              error={error ? decodeURIComponent(error) : null}
              submitLabel="Create Customer"
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
