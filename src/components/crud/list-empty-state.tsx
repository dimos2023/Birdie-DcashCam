import type { LucideIcon } from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";

interface ListEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
}

export function ListEmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
}: ListEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F2F8FC]">
        <Icon className="h-7 w-7 text-[#3B8ECC]" />
      </div>
      <h3 className="text-lg font-semibold text-[#1C3664]">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-[#1C1C1C]/55">{description}</p>
      <LinkButton href={actionHref} className="mt-5 bg-[#1C3664] hover:bg-[#1C3664]/90">
        {actionLabel}
      </LinkButton>
    </div>
  );
}
