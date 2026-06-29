"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FormSubmitButtonProps {
  label: string;
  loadingLabel?: string;
  className?: string;
}

export function FormSubmitButton({
  label,
  loadingLabel = "Saving...",
  className,
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending}
      className={cn("bg-[#1C3664] hover:bg-[#1C3664]/90", className)}
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {loadingLabel}
        </>
      ) : (
        label
      )}
    </Button>
  );
}
