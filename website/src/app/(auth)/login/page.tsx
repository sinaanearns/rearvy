"use client";

import { Suspense } from "react";
import { RearvyLoginForm } from "@/components/auth/rearvy-login-form";

export default function LoginPage() {
  return (
    <Suspense>
      <RearvyLoginForm
        defaultRedirect="/chat"
        title="Welcome back"
        description="Sign in to Rearvy AI"
      />
    </Suspense>
  );
}
