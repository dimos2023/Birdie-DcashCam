import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Reports" };

export default function ReportsPage() {
  return (
    <>
      <PageHeader
        title="Reports"
        description="Fleet analytics, trip summaries, and exportable insights"
      />
      <div className="p-4 md:p-6">
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1C3664]/10">
              <BarChart3 className="h-7 w-7 text-[#1C3664]" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-[#1C3664]">
              Reports coming soon
            </h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Trip reports, utilization metrics, and compliance exports will be
              available in a future release.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
