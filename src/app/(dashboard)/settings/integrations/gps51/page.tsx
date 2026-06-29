import { format } from "date-fns";
import { ArrowLeft, Radio } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGps51Config } from "@/lib/env.server";
import type { Json } from "@/lib/types";

export const metadata = { title: "GPS51 Integration" };

function statusBadgeVariant(status: string) {
  if (status === "processed") return "default" as const;
  if (status === "partial" || status === "parsed") return "secondary" as const;
  if (status === "error") return "destructive" as const;
  return "outline" as const;
}

function payloadPreview(payload: Json | null | undefined): string {
  if (payload == null) return "—";
  try {
    const text = JSON.stringify(payload);
    if (text.length <= 140) return text;
    return `${text.slice(0, 140)}…`;
  } catch {
    return "—";
  }
}

export default async function Gps51IntegrationPage() {
  const config = getGps51Config();
  const webhookUrl = `${config.appUrl.replace(/\/$/, "")}/api/gps51/webhook`;
  const supabase = createAdminClient();

  const logsRes = await supabase
    .from("gps51_webhook_logs")
    .select("*")
    .order("received_at", { ascending: false })
    .limit(20);

  if (logsRes.error) console.error("GPS51 settings logs query failed:", logsRes.error);

  const logs = logsRes.data ?? [];

  return (
    <>
      <PageHeader
        title="GPS51 Integration"
        description="HTTP JSON webhook for forwarded GPS51 device telemetry"
      >
        <LinkButton href="/settings/integrations" variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Integrations
        </LinkButton>
      </PageHeader>

      <div className="space-y-6 p-4 md:p-6">
        {logsRes.error && (
          <Alert variant="destructive">
            <AlertDescription>{logsRes.error.message}</AlertDescription>
          </Alert>
        )}

        <Card className="border border-[#e8f2fa] shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-[#1C3664]/10 p-2">
                <Radio className="h-5 w-5 text-[#1C3664]" />
              </div>
              <div>
                <CardTitle className="text-[#1C3664]">Webhook URL</CardTitle>
                <CardDescription>
                  Configure GPS51 To Servers to POST JSON to this endpoint.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <code className="block overflow-x-auto rounded-lg border border-[#d4e4f0] bg-[#F2F8FC] px-3 py-2 text-sm text-[#1C3664]">
              {webhookUrl}
            </code>
            <p className="text-xs text-muted-foreground">
              Auth via query <code>?secret=YOUR_SECRET</code> or header{" "}
              <code>x-gps51-secret</code>. Set <code>GPS51_WEBHOOK_SECRET</code> in server env.
            </p>
            <Badge variant={config.webhookSecretConfigured ? "default" : "secondary"}>
              {config.webhookSecretConfigured ? "Secret configured" : "Secret not configured"}
            </Badge>
          </CardContent>
        </Card>

        <Card className="border border-[#e8f2fa] shadow-sm">
          <CardHeader>
            <CardTitle className="text-[#1C3664]">Latest webhook logs</CardTitle>
            <CardDescription>Most recent 20 GPS51 payloads received by Birdie Fleet.</CardDescription>
          </CardHeader>
          <CardContent>
            {!logs.length ? (
              <p className="rounded-lg border border-dashed border-[#d4e4f0] bg-[#F2F8FC]/50 px-4 py-8 text-center text-sm text-muted-foreground">
                No webhook events received yet.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#e8f2fa]">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Received</TableHead>
                      <TableHead>Device ID</TableHead>
                      <TableHead>Latitude</TableHead>
                      <TableHead>Longitude</TableHead>
                      <TableHead>Speed</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Error</TableHead>
                      <TableHead>Payload preview</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id} className="hover:bg-[#F2F8FC]/60">
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {format(new Date(log.received_at), "dd MMM yyyy HH:mm:ss")}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {log.parsed_device_id ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {log.parsed_latitude ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {log.parsed_longitude ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {log.parsed_speed_kmh ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(log.status)}>{log.status}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground">
                          {log.error_message ?? "—"}
                        </TableCell>
                        <TableCell
                          className="max-w-[240px] truncate font-mono text-[10px] text-muted-foreground"
                          title={payloadPreview(log.payload)}
                        >
                          {payloadPreview(log.payload)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
