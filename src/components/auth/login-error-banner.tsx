"use client";

import { useSearchParams } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function LoginErrorBanner() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  if (error !== "auth") return null;

  return (
    <Alert variant="destructive">
      <AlertDescription>
        Authentication failed. Please try signing in again.
      </AlertDescription>
    </Alert>
  );
}
