"use client";

import { Suspense } from "react";
import { RearvyLoginForm } from "@/components/auth/rearvy-login-form";

export default function SocietyLoginPage() {
  return (
    <Suspense>
      <RearvyLoginForm
        defaultRedirect="/society/dashboard"
        title="Welcome to Rearvy Society"
        description="Sign in to continue to Rearvy Society"
      />
    </Suspense>
  );
}
