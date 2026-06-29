"use client";

import { useState } from "react";
import { Loader2, Lock, Mail } from "lucide-react";
import { signIn } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BRAND } from "@/lib/constants";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await signIn(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md border border-[#d4e4f0] bg-white shadow-xl shadow-[#1C3664]/5">
      <CardHeader className="space-y-1 pb-2">
        <CardTitle className="text-2xl font-bold text-[#1C3664]">
          Welcome back
        </CardTitle>
        <CardDescription>
          Sign in to your {BRAND.name} account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-5">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-[#1C3664]">
              Email address
            </Label>
            <div className="relative">
              <Mail className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@company.com"
                required
                autoComplete="email"
                className="border-[#d4e4f0] bg-[#F2F8FC] pl-10 focus-visible:border-[#3B8ECC] focus-visible:ring-[#3B8ECC]/30"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-[#1C3664]">
              Password
            </Label>
            <div className="relative">
              <Lock className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="border-[#d4e4f0] bg-[#F2F8FC] pl-10 focus-visible:border-[#3B8ECC] focus-visible:ring-[#3B8ECC]/30"
              />
            </div>
          </div>

          <Button
            type="submit"
            className="h-11 w-full bg-[#1C3664] text-base font-medium hover:bg-[#1C3664]/90"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign in to Dashboard"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
