import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { LinkButton } from "@/components/ui/link-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { updateCustomer } from "@/lib/actions";

export const metadata = { title: "Customer Details" };

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

  const updateWithId = updateCustomer.bind(null, id);

  return (
    <>
      <PageHeader title={customer.name} description="Customer details and settings">
        <LinkButton href="/customers" variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </LinkButton>
      </PageHeader>
      <div className="p-6">
        <Card className="max-w-2xl border-0 shadow-sm">
          <CardContent className="pt-6">
            <form action={updateWithId} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="name">Company Name *</Label>
                  <Input id="name" name="name" defaultValue={customer.name} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_name">Contact Name</Label>
                  <Input id="contact_name" name="contact_name" defaultValue={customer.contact_name ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" defaultValue={customer.email ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" defaultValue={customer.phone ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" name="city" defaultValue={customer.city ?? ""} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" name="address" defaultValue={customer.address ?? ""} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" name="notes" rows={3} defaultValue={customer.notes ?? ""} />
                </div>
                <div className="flex items-center gap-3 sm:col-span-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    name="is_active"
                    value="true"
                    defaultChecked={customer.is_active}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="is_active">Active customer</Label>
                </div>
              </div>
              <Button type="submit" className="bg-[#1C3664] hover:bg-[#1C3664]/90">
                Save Changes
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
