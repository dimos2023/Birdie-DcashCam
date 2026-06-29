import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { cn } from "@/lib/utils";

interface DashboardSectionProps {
  title: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  children: React.ReactNode;
  className?: string;
}

export function DashboardSection({
  title,
  viewAllHref,
  viewAllLabel = "View all",
  children,
  className,
}: DashboardSectionProps) {
  return (
    <Card className={cn("border border-[#e8f2fa] shadow-sm", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base font-semibold text-[#1C3664]">
          {title}
        </CardTitle>
        {viewAllHref && (
          <LinkButton
            href={viewAllHref}
            variant="ghost"
            size="sm"
            className="h-8 text-[#3B8ECC] hover:bg-[#F2F8FC] hover:text-[#1C3664]"
          >
            {viewAllLabel}
            <ArrowRight className="ml-1 h-4 w-4" />
          </LinkButton>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
