import Image from "next/image";
import { BRAND } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Car, Lock, Mail, MapPin, Radio, Shield } from "lucide-react";

export const metadata = {
  title: "Sign In",
  description: `Sign in to ${BRAND.name}`,
};

interface LoginPageProps {
  searchParams: Promise<{ redirectTo?: string; error?: string }>;
}

const FEATURES = [
  {
    icon: MapPin,
    title: "Live GPS Tracking",
    desc: "Monitor your entire fleet in real time with precision maps.",
  },
  {
    icon: Car,
    title: "Dash Cam Intelligence",
    desc: "Multi-channel video, route history, and instant alerts.",
  },
  {
    icon: Radio,
    title: "Live Monitoring",
    desc: "Unified view of vehicles, cameras, and customer comms.",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    desc: "Role-based access with encrypted, compliant infrastructure.",
  },
] as const;

function BrandLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/images/birdie-logo.png"
      alt="Birdie"
      width={120}
      height={52}
      priority
      className={className ?? "h-auto w-28 object-contain"}
    />
  );
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { redirectTo, error } = await searchParams;
  const safeRedirectTo =
    redirectTo &&
    redirectTo.startsWith("/") &&
    !redirectTo.startsWith("//") &&
    !redirectTo.startsWith("/login") &&
    !redirectTo.startsWith("/auth/")
      ? redirectTo
      : "/dashboard";
  const errorMessage = error ? decodeURIComponent(error) : null;

  return (
    <div className="flex min-h-screen">
      {/* Brand panel — desktop */}
      <div className="relative hidden min-h-screen w-[45%] max-w-xl overflow-hidden xl:flex xl:max-w-none xl:flex-1 xl:flex-col xl:justify-between">
        <Image
          src="/images/login-devices.png"
          alt="Birdie dash cam and fleet devices"
          fill
          priority
          sizes="(min-width: 1280px) 50vw, 0px"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-[#1C3664]/25" />
        <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-[#1C3664]/75 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-[#0a1628]/85 via-[#0a1628]/35 to-transparent" />

        <div className="relative z-10 p-10 xl:p-12">
          <BrandLogo className="h-auto w-28 object-contain drop-shadow-md" />
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-white/95 xl:text-3xl">
            {BRAND.name}
          </h1>
          <p className="mt-2 max-w-sm text-base leading-relaxed text-white/60">
            {BRAND.tagline}
          </p>
          <p className="mt-1.5 text-xs font-medium text-[#3B8ECC]/80">
            Intelligent fleet monitoring for Saudi Arabia
          </p>
        </div>

        <div className="relative z-10 space-y-2.5 p-10 pt-0 xl:p-12 xl:pt-0">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="flex gap-3 rounded-lg border border-white/8 bg-white/5 px-3 py-2.5 backdrop-blur-[2px]"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                <feature.icon className="h-4 w-4 text-white/70" />
              </div>
              <div>
                <p className="text-sm font-medium text-white/85">{feature.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-white/45">
                  {feature.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        <p className="relative z-10 p-10 text-xs text-white/30 xl:p-12">
          © {new Date().getFullYear()} Birdie · Saudi Automotive Technology
        </p>
      </div>

      {/* Login form panel */}
      <div className="flex flex-1 flex-col items-center justify-center bg-[#F2F8FC] px-6 py-10 sm:px-10">
        <div className="mb-8 w-full max-w-md text-center xl:hidden">
          <div className="mx-auto mb-4 flex justify-center">
            <BrandLogo className="h-auto w-24 object-contain" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1C3664]">
            {BRAND.name}
          </h1>
          <p className="mt-1.5 text-sm text-[#1C1C1C]/60">{BRAND.tagline}</p>
        </div>

        <div className="w-full max-w-md">
          <Card className="w-full border border-[#d4e4f0]/80 bg-white shadow-xl shadow-[#1C3664]/8">
            <CardHeader className="space-y-1.5 pb-2">
              <CardTitle className="text-2xl font-bold tracking-tight text-[#1C3664]">
                Welcome back
              </CardTitle>
              <CardDescription className="text-[#1C1C1C]/55">
                Sign in to your {BRAND.name} account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action="/auth/login" method="post" className="space-y-5">
                <input type="hidden" name="redirectTo" value={safeRedirectTo} />

                {errorMessage && (
                  <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-[#1C3664]">
                    Email address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#1C1C1C]/40" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="you@company.com"
                      required
                      autoComplete="email"
                      className="h-11 border-[#d4e4f0] bg-[#F2F8FC] pl-10 text-[#1C1C1C] placeholder:text-[#1C1C1C]/35 focus-visible:border-[#3B8ECC] focus-visible:ring-[#3B8ECC]/25"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-[#1C3664]">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#1C1C1C]/40" />
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                      className="h-11 border-[#d4e4f0] bg-[#F2F8FC] pl-10 text-[#1C1C1C] placeholder:text-[#1C1C1C]/35 focus-visible:border-[#3B8ECC] focus-visible:ring-[#3B8ECC]/25"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="h-11 w-full bg-[#1C3664] text-base font-semibold text-white shadow-md shadow-[#1C3664]/20 hover:bg-[#1C3664]/90"
                >
                  Sign in to Dashboard
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <p className="mt-10 text-center text-xs text-[#1C1C1C]/45 xl:hidden">
          © {new Date().getFullYear()} Birdie · Saudi Automotive Technology
        </p>
      </div>
    </div>
  );
}
