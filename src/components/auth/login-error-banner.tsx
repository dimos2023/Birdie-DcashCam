"use client";

import { useSearchParams } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function LoginErrorBanner() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  if (error === "auth") {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Authentication failed. Please try signing in again.
        </AlertDescription>
      </Alert>
    );
  }

  if (error === "deactivated") {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Your account has been deactivated. Contact your administrator.
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
