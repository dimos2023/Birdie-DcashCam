import { MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "WhatsApp" };

export default function WhatsappPage() {
  return (
    <>
      <PageHeader
        title="WhatsApp"
        description="Fleet messaging and customer communications"
      />
      <div className="p-4 md:p-6">
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#25D366]/10">
              <MessageCircle className="h-7 w-7 text-[#25D366]" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-[#1C3664]">
              WhatsApp Fleet Messaging
            </h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Open a vehicle&apos;s live page to chat with customers via WhatsApp.
              Configure the Cloud API in Settings → Integrations.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
