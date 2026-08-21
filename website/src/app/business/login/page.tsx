"use client";

import { Suspense } from "react";
import { RearvyPublicShell } from "@/components/public/rearvy-public-shell";
import { RearvyLoginForm } from "@/components/auth/rearvy-login-form";

export default function BusinessLoginPage() {
  return (
    <RearvyPublicShell
      authLinks={{
        login: "/business/login",
        signup: "/business/signup",
      }}
    >
      <section className="mx-auto w-full max-w-[560px] px-6 pt-28">
        <Suspense>
          <RearvyLoginForm
            defaultRedirect="/business/dashboard"
            title="Business sign in"
            description="Sign in to your Rearvy business workspace"
            disableDesktopBridge
            signupHrefOverride="/business/signup"
            preferDefaultRedirect
          />
        </Suspense>
      </section>
    </RearvyPublicShell>
  );
}