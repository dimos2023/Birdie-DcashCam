import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Map, MessageCircle, Database, Shield, Radio } from "lucide-react";
import Link from "next/link";
import { getGoogleMapsApiKey, getWhatsAppConfig, getGps51Config } from "@/lib/env.server";
import { getPublicSupabaseConfig } from "@/lib/supabase/config";

export const metadata = { title: "Integrations" };

export default function IntegrationsSettingsPage() {
  const whatsapp = getWhatsAppConfig();
  const mapsKey = getGoogleMapsApiKey();
  const gps51 = getGps51Config();
  const supabaseConfigured = (() => {
    try {
      getPublicSupabaseConfig();
      return true;
    } catch {
      return false;
    }
  })();

  const integrations = [
    {
      name: "Supabase",
      description: "Database, authentication, realtime, and storage (RLS enabled)",
      icon: Database,
      status: supabaseConfigured ? "connected" : "not_configured",
      envKeys: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
      serverOnly: ["SUPABASE_SERVICE_ROLE_KEY"],
    },
    {
      name: "Google Maps",
      description: "Live vehicle tracking and route playback",
      icon: Map,
      status: mapsKey ? "connected" : "not_configured",
      envKeys: ["GOOGLE_MAPS_API_KEY"],
      serverOnly: [] as string[],
    },
    {
      name: "WhatsApp Cloud API",
      description: "Customer messaging and fleet alerts via WhatsApp",
      icon: MessageCircle,
      status: whatsapp.accessToken ? "connected" : "not_configured",
      envKeys: [] as string[],
      serverOnly: [
        "WHATSAPP_PHONE_NUMBER_ID",
        "WHATSAPP_ACCESS_TOKEN",
        "WHATSAPP_VERIFY_TOKEN",
      ],
    },
  ] as const;

  return (
    <>
      <PageHeader
        title="Integrations"
        description="Configure third-party services and API connections"
      />
      <div className="space-y-6 p-6">
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-[#1C3664]/10 p-2">
                <Shield className="h-5 w-5 text-[#1C3664]" />
              </div>
              <div>
                <CardTitle className="text-[#1C3664]">Security</CardTitle>
                <CardDescription>
                  Service role and API secrets are server-only. Mutations run through
                  Server Actions with RLS enforced via the anon key + user session.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {integrations.map((integration) => (
          <Card key={integration.name} className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-[#1C3664]/10 p-2">
                    <integration.icon className="h-5 w-5 text-[#1C3664]" />
                  </div>
                  <div>
                    <CardTitle className="text-[#1C3664]">{integration.name}</CardTitle>
                    <CardDescription>{integration.description}</CardDescription>
                  </div>
                </div>
                <Badge
                  variant={integration.status === "connected" ? "default" : "secondary"}
                  className={
                    integration.status === "connected"
                      ? "bg-green-100 text-green-800 hover:bg-green-100"
                      : ""
                  }
                >
                  {integration.status === "connected" ? "Connected" : "Not Configured"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {integration.envKeys.map((key) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Client-safe</Label>
                  <Input value={key} readOnly className="font-mono text-sm" />
                </div>
              ))}
              {integration.serverOnly.map((key) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Server-only</Label>
                  <Input value={key} readOnly className="font-mono text-sm" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-[#1C3664]/10 p-2">
                  <Radio className="h-5 w-5 text-[#1C3664]" />
                </div>
                <div>
                  <CardTitle className="text-[#1C3664]">GPS51</CardTitle>
                  <CardDescription>
                    HTTP JSON webhook for forwarded GPS device locations and telemetry
                  </CardDescription>
                </div>
              </div>
              <Badge
                variant={gps51.webhookSecretConfigured ? "default" : "secondary"}
                className={
                  gps51.webhookSecretConfigured
                    ? "bg-green-100 text-green-800 hover:bg-green-100"
                    : ""
                }
              >
                {gps51.webhookSecretConfigured ? "Configured" : "Not Configured"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Server-only</Label>
              <Input value="GPS51_WEBHOOK_SECRET" readOnly className="font-mono text-sm" />
            </div>
            <Link
              href="/settings/integrations/gps51"
              className="inline-flex text-sm font-medium text-[#3B8ECC] hover:text-[#1C3664]"
            >
              Open GPS51 setup, logs, and device mappings →
            </Link>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-[#1C3664]">Video Streaming</CardTitle>
            <CardDescription>
              WebRTC and HLS stream endpoints are configured per camera channel in the database
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border p-4">
                <p className="font-medium">WebRTC</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Low-latency live streaming via signaling server URL per camera stream
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="font-medium">HLS</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Adaptive bitrate streaming via HLS manifest URL per camera channel
                </p>
              </div>
            </div>
            <Button variant="outline" disabled>
              Streaming server configuration coming soon
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
