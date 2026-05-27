import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | Rearvy",
  description:
    "Terms of Service for Rearvy, including usage rules, billing terms, and beta product limitations.",
};

const LAST_UPDATED = "March 13, 2026";

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 px-4 py-12 sm:py-16">
      <div className="mx-auto max-w-3xl space-y-10">
        <header className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-600">
            Legal
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Terms of Service
          </h1>
          <p className="text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
          <p className="text-base text-muted-foreground">
            These terms govern your use of Rearvy. By accessing or using the
            service, you agree to these terms.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">1. Use of service</h2>
          <p className="text-muted-foreground">
            You may use Rearvy only in compliance with applicable laws and these
            terms. You are responsible for your account credentials, connected
            integrations, and actions performed through your account.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">2. Integrations and third-party services</h2>
          <p className="text-muted-foreground">
            Rearvy may connect with third-party platforms such as Google, Shopify,
            Meta, and payment providers. Your use of those services remains subject
            to their own terms and privacy policies.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">3. Billing and subscriptions</h2>
          <p className="text-muted-foreground">
            Paid plans may be billed through third-party processors. You authorize
            applicable charges based on your selected plan. Unless stated otherwise,
            fees are non-refundable except where required by law.
          </p>
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-500/30 bg-slate-500/10 p-6">
          <h2 className="text-2xl font-semibold tracking-tight">4. Beta service disclaimer</h2>
          <p className="text-foreground/90">
            Rearvy is currently provided in beta. Features may change without prior
            notice, may contain defects, and may occasionally be unavailable. Outputs
            and recommendations are provided for informational purposes and should be
            independently validated before making business-critical decisions.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">5. Acceptable use</h2>
          <p className="text-muted-foreground">
            You agree not to misuse the service, attempt unauthorized access,
            interfere with platform operations, or use the service for unlawful,
            harmful, fraudulent, or abusive purposes.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">6. Limitation of liability</h2>
          <p className="text-muted-foreground">
            To the maximum extent permitted by law, Rearvy and its operators are not
            liable for indirect, incidental, special, consequential, or punitive
            damages, or for lost profits, revenue, data, or goodwill arising from
            your use of the service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">7. Changes to terms</h2>
          <p className="text-muted-foreground">
            We may update these terms from time to time. Continued use of the
            service after updates constitutes acceptance of the revised terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">8. Contact</h2>
          <p className="text-muted-foreground">
            For questions about these terms, contact sinaanfire@gmail.com.
          </p>
        </section>

        <div className="pt-4 space-y-2">
          <Link
            href="/"
            className="block text-sm font-medium text-slate-700 underline-offset-4 hover:underline"
          >
            Back to home
          </Link>
          <Link
            href="/privacy-policy"
            className="block text-sm font-medium text-slate-700 underline-offset-4 hover:underline"
          >
            View Privacy Policy
          </Link>
        </div>
      </div>
    </main>
  );
}
