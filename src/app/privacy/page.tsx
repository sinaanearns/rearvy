import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Rearvy",
  description:
    "Privacy Policy for Rearvy, including data handling and beta product disclosure.",
};

const LAST_UPDATED = "March 13, 2026";

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 px-4 py-12 sm:py-16">
      <div className="mx-auto max-w-3xl space-y-10">
        <header className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-600">
            Legal
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Privacy Policy
          </h1>
          <p className="text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
          <p className="text-base text-muted-foreground">
            This policy explains how Rearvy collects, uses, stores, and protects your
            information when you use our website and services.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">1. Information we collect</h2>
          <p className="text-muted-foreground">
            We may collect account information such as your name, email address, and
            authentication details. When you connect integrations, we may process
            tokens and metadata required to access selected platform data.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">2. How we use information</h2>
          <p className="text-muted-foreground">
            We use your information to provide product functionality, authenticate users,
            run connected integrations, improve service performance, and communicate
            important product or security updates.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">3. Data sharing</h2>
          <p className="text-muted-foreground">
            We do not sell personal information. We may share data with infrastructure,
            analytics, payment, and integration providers only as needed to operate the
            service, or when required by law.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">4. Security and retention</h2>
          <p className="text-muted-foreground">
            We apply reasonable technical and organizational safeguards to protect data.
            No system is fully secure, and you acknowledge this risk by using the
            service. We retain data only as long as necessary for service delivery,
            legal compliance, and legitimate business purposes.
          </p>
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-500/30 bg-slate-500/10 p-6">
          <h2 className="text-2xl font-semibold tracking-tight">5. Beta product notice</h2>
          <p className="text-foreground/90">
            Rearvy is currently in beta. Features, models, and outputs may change,
            contain inaccuracies, or be interrupted while we improve reliability.
            Please independently verify critical business decisions and reports.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">6. Your choices</h2>
          <p className="text-muted-foreground">
            You can manage account information, connected integrations, and communication
            preferences in the app settings where available. You can also request account
            deletion or support via the contact address below.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">7. Contact</h2>
          <p className="text-muted-foreground">
            For privacy questions, contact us at mutalvita@gmail.com.
          </p>
        </section>

        <div className="pt-4">
          <Link
            href="/"
            className="text-sm font-medium text-slate-700 underline-offset-4 hover:underline"
          >
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
