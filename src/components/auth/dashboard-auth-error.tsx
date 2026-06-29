import { AlertCircle, LogOut } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";

interface DashboardAuthErrorProps {
  title: string;
  description: string;
  detail?: string;
  userEmail?: string;
}

export function DashboardAuthError({
  title,
  description,
  detail,
  userEmail,
}: DashboardAuthErrorProps) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#F2F8FC] p-6">
      <Card className="w-full max-w-lg border border-[#e8f2fa] shadow-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
            <AlertCircle className="h-6 w-6 text-amber-600" />
          </div>
          <CardTitle className="text-[#1C3664]">{title}</CardTitle>
          <CardDescription className="text-base">{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {userEmail && (
            <p className="rounded-lg bg-[#F2F8FC] px-3 py-2 text-center text-sm text-[#1C1C1C]/70">
              Signed in as <span className="font-medium text-[#1C3664]">{userEmail}</span>
            </p>
          )}
          {detail && (
            <p className="rounded-lg border border-dashed border-[#d4e4f0] px-3 py-2 text-xs text-[#1C1C1C]/55">
              {detail}
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <LinkButton href="/logout" variant="outline" className="w-full sm:w-auto">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </LinkButton>
            <LinkButton href="/login" className="w-full bg-[#1C3664] sm:w-auto">
              Back to login
            </LinkButton>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
