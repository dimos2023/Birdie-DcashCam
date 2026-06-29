import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { LinkButton } from "@/components/ui/link-button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-[#d4e4f0] bg-[#F2F8FC]/50 px-6 py-10 text-center",
        className
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#1C3664]/8">
        <Icon className="h-6 w-6 text-[#3B8ECC]" />
      </div>
      <p className="font-semibold text-[#1C3664]">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-[#1C1C1C]/55">{description}</p>
      {actionLabel && actionHref && (
        <LinkButton
          href={actionHref}
          size="sm"
          className="mt-4 bg-[#1C3664] hover:bg-[#1C3664]/90"
        >
          {actionLabel}
        </LinkButton>
      )}
    </div>
  );
}
