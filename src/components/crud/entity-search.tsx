"use client";

import { Search, X } from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface EntitySearchProps {
  placeholder?: string;
  paramName?: string;
}

export function EntitySearch({
  placeholder = "Search...",
  paramName = "q",
}: EntitySearchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const current = searchParams.get(paramName) ?? "";

  const updateSearch = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value.trim()) {
        params.set(paramName, value.trim());
      } else {
        params.delete(paramName);
      }
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`);
      });
    },
    [paramName, pathname, router, searchParams]
  );

  return (
    <div className="relative max-w-md">
      <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#1C1C1C]/35" />
      <Input
        key={current}
        defaultValue={current}
        placeholder={placeholder}
        className="h-10 border-[#d4e4f0] bg-white pl-9 pr-9 focus-visible:border-[#3B8ECC] focus-visible:ring-[#3B8ECC]/20"
        onChange={(e) => updateSearch(e.target.value)}
        disabled={isPending}
      />
      {current && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-1/2 right-1 -translate-y-1/2 text-[#1C1C1C]/40"
          onClick={() => updateSearch("")}
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
