import Link from "next/link";
import { Plug, UserCog, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Settings" };

const settingsLinks = [
  {
    href: "/settings/users",
    title: "Users & Roles",
    description: "Manage team members and role-based access control",
    icon: UserCog,
  },
  {
    href: "/settings/integrations",
    title: "Integrations",
    description: "Google Maps, WhatsApp Cloud API, and Supabase configuration",
    icon: Plug,
  },
];

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Platform configuration and administration" />
      <div className="grid gap-4 p-4 md:grid-cols-2 md:p-6">
        {settingsLinks.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="h-full border-0 shadow-sm transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-start gap-4">
                <div className="rounded-xl bg-[#1C3664]/10 p-3">
                  <item.icon className="h-5 w-5 text-[#1C3664]" />
                </div>
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-[#1C3664]">{item.title}</CardTitle>
                  <CardDescription className="mt-1">{item.description}</CardDescription>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              </CardHeader>
              <CardContent />
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
