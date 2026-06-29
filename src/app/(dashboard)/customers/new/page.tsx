import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { LinkButton } from "@/components/ui/link-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { createCustomer } from "@/lib/actions";

export const metadata = { title: "New Customer" };

export default function NewCustomerPage() {
  return (
    <>
      <PageHeader title="New Customer" description="Add a new fleet customer">
        <LinkButton href="/customers" variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </LinkButton>
      </PageHeader>
      <div className="p-6">
        <Card className="max-w-2xl border-0 shadow-sm">
          <CardContent className="pt-6">
            <form action={createCustomer} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="name">Company Name *</Label>
                  <Input id="name" name="name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_name">Contact Name</Label>
                  <Input id="contact_name" name="contact_name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" name="city" defaultValue="Riyadh" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" name="address" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" name="notes" rows={3} />
                </div>
              </div>
              <Button type="submit" className="bg-[#1C3664] hover:bg-[#1C3664]/90">
                Create Customer
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
