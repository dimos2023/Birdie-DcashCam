"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatExactTime, formatRelativeTime } from "@/lib/gps51/fleet-utils";

export function Gps51TimeCell({ value }: { value: string | null | undefined }) {
  const relative = formatRelativeTime(value);
  const exact = formatExactTime(value);

  if (relative === "—") {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="cursor-default text-muted-foreground underline decoration-dotted underline-offset-2">
            {relative}
          </span>
        }
      />
      <TooltipContent>{exact}</TooltipContent>
    </Tooltip>
  );
}
