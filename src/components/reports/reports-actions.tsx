"use client";

import { Download, Printer, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface ReportsActionsProps {
  csvContent: string;
  filename?: string;
}

export function ReportsActions({
  csvContent,
  filename = "birdie-fleet-report.csv",
}: ReportsActionsProps) {
  const router = useRouter();

  const handleRefresh = () => {
    router.refresh();
  };

  const handleExport = () => {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <Button
        type="button"
        variant="outline"
        className="border-[#d4e4f0] bg-white text-[#1C3664] hover:bg-[#F2F8FC]"
        onClick={handleRefresh}
      >
        <RefreshCw className="mr-2 h-4 w-4" />
        Refresh Report
      </Button>
      <Button
        type="button"
        variant="outline"
        className="border-[#d4e4f0] bg-white text-[#1C3664] hover:bg-[#F2F8FC]"
        onClick={handleExport}
      >
        <Download className="mr-2 h-4 w-4" />
        Export CSV
      </Button>
      <Button
        type="button"
        className="bg-[#1C3664] hover:bg-[#1C3664]/90"
        onClick={handlePrint}
      >
        <Printer className="mr-2 h-4 w-4" />
        Print Report
      </Button>
    </div>
  );
}
