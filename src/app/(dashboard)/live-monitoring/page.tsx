import { PageHeader } from "@/components/layout/page-header";
import { JtTerminalMonitor } from "@/components/jt/jt-terminal-monitor";
import { createClient } from "@/lib/supabase/server";
import { getActionContext } from "@/lib/actions/context";
import type { JtTerminalLive } from "@/lib/types";

export const metadata = { title: "Live Monitoring" };

export default async function LiveMonitoringPage() {
  const supabase = await createClient();
  const ctx = await getActionContext();

  const { data: terminals } = await supabase
    .from("jt_terminal_live")
    .select("*")
    .eq("organization_id", ctx.organizationId)
    .order("terminal_no");

  return (
    <>
      <PageHeader
        title="Live Monitoring"
        description="Direct JT/T terminals — GPS, alarms, and camera streams via the Birdie gateway"
      />
      <div className="grid gap-4 p-4 md:grid-cols-2 md:p-6 lg:grid-cols-3">
        <JtTerminalMonitor
          initialTerminals={(terminals ?? []) as JtTerminalLive[]}
          organizationId={ctx.organizationId}
        />
      </div>
    </>
  );
}
