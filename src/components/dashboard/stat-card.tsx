import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: string;
  className?: string;
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  className,
}: StatCardProps) {
  return (
    <Card className={cn("border-0 shadow-sm", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="rounded-lg bg-[#1C3664]/10 p-2">
          <Icon className="h-4 w-4 text-[#1C3664]" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-[#1C3664]">{value}</div>
        {(description || trend) && (
          <p className="mt-1 text-xs text-muted-foreground">
            {trend && <span className="text-[#3B8ECC]">{trend} </span>}
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
