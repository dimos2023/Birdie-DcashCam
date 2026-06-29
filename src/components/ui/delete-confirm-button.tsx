"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DeleteAction = (id: string) => Promise<{ success: boolean; error?: string }>;

interface DeleteConfirmButtonProps {
  id: string;
  confirmMessage: string;
  deleteAction: DeleteAction;
  redirectTo: string;
  size?: "sm" | "default" | "icon-sm";
  className?: string;
}

export function DeleteConfirmButton({
  id,
  confirmMessage,
  deleteAction,
  redirectTo,
  size = "sm",
  className,
}: DeleteConfirmButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!window.confirm(confirmMessage)) {
      return;
    }

    startTransition(async () => {
      const result = await deleteAction(id);
      if (result.success) {
        router.push(redirectTo);
        router.refresh();
      } else {
        window.alert(result.error ?? "Delete failed. Please try again.");
      }
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size={size}
      onClick={handleClick}
      disabled={isPending}
      className={cn("text-destructive hover:bg-destructive/10 hover:text-destructive", className)}
    >
      {isPending ? (
        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
      ) : (
        <Trash2 className="mr-1 h-3.5 w-3.5" />
      )}
      Delete
    </Button>
  );
}
