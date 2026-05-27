import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Rearvy",
  description:
    "Privacy Policy for Rearvy, including data collection, processing, retention, and deletion rights.",
};

const LAST_UPDATED = "April 7, 2026";

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
            We may collect account information such as your name, email address,
            profile image, and authentication details. When you connect integrations,
            we may process tokens and metadata needed to access selected platform data.
            We also collect technical data such as log events, device/browser details,
            and usage analytics to secure and improve the service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">2. How we use information</h2>
          <p className="text-muted-foreground">
            We use your information to provide product functionality, authenticate users,
            run connected integrations, improve service performance, detect abuse,
            provide customer support, and communicate important product or security
            updates.
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
          <h2 className="text-2xl font-semibold tracking-tight">4. Legal bases and permissions</h2>
          <p className="text-muted-foreground">
            We process data to perform our contract with you, for legitimate interests
            such as service security and product improvement, and where required, based
            on your consent. If you connect third-party services (for example, Facebook,
            Instagram, YouTube, Shopify, or Gmail), we only access data you authorize.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">5. Security and retention</h2>
          <p className="text-muted-foreground">
            We apply reasonable technical and organizational safeguards to protect data.
            No system is fully secure, and you acknowledge this risk by using the
            service. We retain data only as long as necessary for service delivery,
            legal compliance, and legitimate business purposes.
          </p>
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-500/30 bg-slate-500/10 p-6">
          <h2 className="text-2xl font-semibold tracking-tight">6. Beta product notice</h2>
          <p className="text-foreground/90">
            Rearvy is currently in beta. Features, models, and outputs may change,
            contain inaccuracies, or be interrupted while we improve reliability.
            Please independently verify critical business decisions and reports.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">7. Your choices and rights</h2>
          <p className="text-muted-foreground">
            You can manage account information, connected integrations, and communication
            preferences in the app settings where available. Depending on your location,
            you may request access, correction, deletion, or export of your personal
            information by contacting us.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">8. Data deletion instructions</h2>
          <p className="text-muted-foreground">
            You can request deletion of your Rearvy account data by emailing
            mutalvita@gmail.com with the subject line "Data Deletion Request" from your
            account email address.
          </p>
          <p className="text-muted-foreground">
            If you connected Facebook or Instagram, you can also remove Rearvy access in
            your Meta settings. After receiving your request, we delete or anonymize
            personal data unless retention is required by law.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">9. Children&apos;s privacy</h2>
          <p className="text-muted-foreground">
            Rearvy is not directed to children under 13, and we do not knowingly collect
            personal information from children.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">10. Policy updates</h2>
          <p className="text-muted-foreground">
            We may update this policy from time to time. Material changes will be posted
            on this page with a revised "Last updated" date.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">11. Contact</h2>
          <p className="text-muted-foreground">
            For privacy questions, contact us at sinaanfire@gmail.com.
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
