import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { LoginErrorBanner } from "@/components/auth/login-error-banner";
import { BRAND } from "@/lib/constants";
import { Car, MapPin, Radio, Shield } from "lucide-react";

export const metadata = {
  title: "Sign In",
  description: `Sign in to ${BRAND.name}`,
};

interface LoginPageProps {
  searchParams: Promise<{ redirectTo?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { redirectTo } = await searchParams;

  return (
    <div className="flex min-h-screen">
      {/* Brand panel — desktop */}
      <div className="relative hidden w-[45%] max-w-xl overflow-hidden bg-[#1C3664] xl:flex xl:max-w-none xl:flex-1 xl:flex-col xl:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_#3B8ECC40_0%,_transparent_55%)]" />
        <div className="absolute -bottom-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-[#3B8ECC]/15 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="relative z-10 p-10 xl:p-14">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#3B8ECC] shadow-lg shadow-[#3B8ECC]/30">
            <span className="text-2xl font-bold text-white">B</span>
          </div>
          <h1 className="mt-10 text-4xl font-bold tracking-tight text-white xl:text-5xl">
            {BRAND.name}
          </h1>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-white/70">
            {BRAND.tagline}
          </p>
          <p className="mt-2 text-sm text-[#3B8ECC]">
            Intelligent fleet monitoring for Saudi Arabia
          </p>
        </div>

        <div className="relative z-10 space-y-5 p-10 xl:p-14">
          {[
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
          ].map((feature) => (
            <div
              key={feature.title}
              className="flex gap-4 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#3B8ECC]/25">
                <feature.icon className="h-5 w-5 text-[#3B8ECC]" />
              </div>
              <div>
                <p className="font-semibold text-white">{feature.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-white/55">
                  {feature.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        <p className="relative z-10 p-10 text-xs text-white/35 xl:p-14">
          © {new Date().getFullYear()} Birdie · Saudi Automotive Technology
        </p>
      </div>

      {/* Login form panel */}
      <div className="flex flex-1 flex-col items-center justify-center bg-[#F2F8FC] px-6 py-10 sm:px-10">
        <div className="mb-8 w-full max-w-md text-center xl:hidden">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1C3664] shadow-lg shadow-[#1C3664]/20">
            <span className="text-2xl font-bold text-white">B</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1C3664]">
            {BRAND.name}
          </h1>
          <p className="mt-1.5 text-sm text-[#1C1C1C]/60">{BRAND.tagline}</p>
        </div>

        <div className="w-full max-w-md space-y-4">
          <Suspense fallback={null}>
            <LoginErrorBanner />
          </Suspense>
          <LoginForm redirectTo={redirectTo} />
        </div>

        <p className="mt-10 text-center text-xs text-[#1C1C1C]/45 xl:hidden">
          © {new Date().getFullYear()} Birdie · Saudi Automotive Technology
        </p>
      </div>
    </div>
  );
}
