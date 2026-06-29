import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { LoginErrorBanner } from "@/components/auth/login-error-banner";
import { BRAND } from "@/lib/constants";
import { Car, MapPin, Shield } from "lucide-react";

export const metadata = {
  title: "Sign In",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className="relative hidden w-1/2 overflow-hidden bg-[#1C3664] lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_#3B8ECC33_0%,_transparent_60%)]" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-[#3B8ECC]/20 blur-3xl" />

        <div className="relative z-10 p-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
            <span className="text-xl font-bold text-white">B</span>
          </div>
          <h1 className="mt-8 text-4xl font-bold tracking-tight text-white">
            {BRAND.name}
          </h1>
          <p className="mt-3 max-w-sm text-lg text-white/70">{BRAND.tagline}</p>
        </div>

        <div className="relative z-10 space-y-6 p-10">
          {[
            {
              icon: MapPin,
              title: "Live GPS Tracking",
              desc: "Monitor your entire fleet in real time across Saudi Arabia.",
            },
            {
              icon: Car,
              title: "Vehicle Intelligence",
              desc: "Dash cams, route history, and instant alerts in one platform.",
            },
            {
              icon: Shield,
              title: "Enterprise Security",
              desc: "Role-based access with encrypted, compliant infrastructure.",
            },
          ].map((feature) => (
            <div key={feature.title} className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#3B8ECC]/20">
                <feature.icon className="h-5 w-5 text-[#3B8ECC]" />
              </div>
              <div>
                <p className="font-medium text-white">{feature.title}</p>
                <p className="mt-0.5 text-sm text-white/60">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="relative z-10 p-10 text-xs text-white/40">
          © {new Date().getFullYear()} Birdie · Saudi Automotive Technology
        </p>
      </div>

      {/* Login form panel */}
      <div className="flex flex-1 flex-col items-center justify-center bg-[#F2F8FC] p-6 sm:p-10">
        <div className="mb-8 text-center lg:hidden">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1C3664]">
            <span className="text-xl font-bold text-white">B</span>
          </div>
          <h1 className="text-2xl font-bold text-[#1C3664]">{BRAND.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{BRAND.tagline}</p>
        </div>

        <div className="w-full max-w-md space-y-4">
          <Suspense fallback={null}>
            <LoginErrorBanner />
          </Suspense>
          <LoginForm />
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground lg:hidden">
          © {new Date().getFullYear()} Birdie · Saudi Automotive Technology
        </p>
      </div>
    </div>
  );
}
