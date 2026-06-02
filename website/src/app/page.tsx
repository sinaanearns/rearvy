"use client";

import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#06060a] text-white selection:bg-white selection:text-black">
      <div className="mx-auto flex min-h-screen max-w-[1500px] items-center justify-between gap-8 px-6 py-16">
        <div className="w-full max-w-2xl">
          <p className="mb-4 inline-flex rounded-full bg-[#1b1b1f] px-3 py-1 text-sm font-semibold">New: Rearvy is now free to use</p>

          <h1 className="mt-6 text-left font-poster text-[52px] leading-[1.02] sm:text-[76px] lg:text-[96px]">
            Rearvy is an
            <span className="block">OS-level business</span>
            <span className="block">operating system.</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg text-[#cfd2d8]">
            Who can read, see, and execute better than you and your employees. Scale 10x easily with this free to use and first business executive platform.
          </p>

          <div className="mt-8 flex gap-4">
            <Link href="/signup" className="rounded bg-white px-6 py-3 font-bold text-black">
              Start for free
            </Link>
            <Link href="/download" className="rounded border border-white px-6 py-3 font-semibold">
              Download
            </Link>
            <Link href="/docs" className="rounded px-6 py-3 font-semibold">
              Start building
            </Link>
          </div>

          <div className="mt-6 flex items-center gap-4">
            <div className="flex -space-x-2">
              <Image src="/rearvy-logo.png" alt="avatar" width={40} height={40} className="rounded-full border-2 border-white" />
              <Image src="/rearvy-logo.png" alt="avatar" width={40} height={40} className="rounded-full border-2 border-white" />
              <Image src="/rearvy-logo.png" alt="avatar" width={40} height={40} className="rounded-full border-2 border-white" />
            </div>
            <div className="text-sm text-[#9aa0a6]">Join operators building the future</div>
          </div>
        </div>

        <div className="relative hidden w-1/2 rounded-2xl border-2 border-white bg-black p-2 shadow-[0_0_60px_rgba(99,102,241,0.6)] lg:block">
          <div className="relative h-[520px] w-full overflow-hidden rounded-xl border-2 border-[#111] bg-[#0b0b0d]">
            <Image src="/images/dashboard_mockup.png" alt="rearvy mockup" fill style={{ objectFit: 'contain' }} priority />
          </div>
        </div>
      </div>
    </main>
  );
}
                </h2>
              </div>
              <div className="border-t-4 border-black pt-6 lg:border-l-4 lg:border-t-0 lg:pl-8 lg:pt-0">
                <div className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.16em]">
                  <Sparkles size={18} />
                  Subscription first, extra usage when needed
                </div>
                <p className="mt-5 text-base font-black leading-7 text-black/74">
                  Rearvy will start free, then package heavier AI, automation,
                  media, and trading workloads behind monthly credits.
                </p>
              </div>
            </div>

            <div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-2">
              {PRICING_PLANS.map((plan) => {
                const isFreePlan = plan.name === "Free";
                const isBusinessPlan = plan.name === "Business";
                const isPaidPlan = isBusinessPlan;
                const isComingSoon = !isFreePlan && !isPaidPlan;

                return (
                <article
                  key={plan.name}
                  className="flex min-h-[440px] flex-col border-2 border-black bg-[#f2f2f2] p-5 shadow-[6px_6px_0_#050505] motion-safe:transition-transform motion-safe:duration-200 motion-safe:hover:-translate-y-2"
                >
                  <div className="flex items-center justify-between gap-3 border-b-2 border-black pb-4">
                    <h3 className="font-poster text-[34px] leading-none">{plan.name}</h3>
                    {isComingSoon && (
                      <span className="shrink-0 border-2 border-black bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em]">
                        Soon
                      </span>
                    )}
                  </div>

                  <div className="border-b-2 border-black py-5">
                    <div className="flex items-end gap-1">
                      <span className="font-poster text-[48px] leading-none">{plan.price}</span>
                      <span className="pb-2 text-xs font-black uppercase tracking-[0.14em] text-black/60">
                        {plan.cadence}
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-black/60">
                      {plan.annual}
                    </p>
                  </div>

                  <div className="border-b-2 border-black py-5">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-black/56">
                      For
                    </p>
                    <p className="mt-2 min-h-12 text-base font-black leading-6">
                      {plan.audience}
                    </p>
                    <p className="mt-4 border-2 border-black bg-white px-3 py-2 text-sm font-black">
                      {plan.credits}
                    </p>
                  </div>

                  {plan.features.length > 0 && (
                    <ul className="mt-5 grid gap-3">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-sm font-bold leading-5">
                          <CheckCircle2 className="mt-0.5 shrink-0" size={16} />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-auto pt-6">
                    {isFreePlan ? (
                      <Link
                        href={user ? "/chat" : "/signup"}
                        className="flex h-11 items-center justify-center border-2 border-black bg-black px-3 text-xs font-black uppercase tracking-[0.16em] text-white transition-colors hover:bg-white hover:text-black"
                      >
                        Start free
                      </Link>
                    ) : isPaidPlan ? (
                      <Link
                        href={user ? "/settings#plan" : `/signup?redirect=${encodeURIComponent("/settings#plan")}`}
                        className="flex h-11 items-center justify-center border-2 border-black bg-black px-3 text-xs font-black uppercase tracking-[0.16em] text-white transition-colors hover:bg-white hover:text-black"
                      >
                        Pay with MetaMask
                      </Link>
                    ) : (
                      <div className="flex h-11 items-center justify-center border-2 border-black bg-black px-3 text-xs font-black uppercase tracking-[0.16em] text-white">
                        Coming soon
                      </div>
                    )}
                  </div>
                </article>
                );
              })}
            </div>

            <div className="mt-12 grid gap-8 border-2 border-black bg-[#f2f2f2] p-6 shadow-[6px_6px_0_#050505] lg:grid-cols-[0.42fr_0.58fr] lg:p-8">
              <div>
                <p className="stamp-label inline-flex">Business freemium</p>
                <h3 className="mt-5 font-poster text-[44px] leading-none sm:text-[58px]">
                  REQUEST 100% FREE BUSINESS.
                </h3>
                <p className="mt-5 max-w-xl text-base font-black leading-7 text-black/74">
                  Businesses can ask Rearvy for free Business access. Share your
                  business, how you plan to use Rearvy, and the Gmail we should
                  contact.
                </p>
              </div>

              <form onSubmit={submitBusinessRequest} className="grid gap-4">
                <div className="grid gap-2">
                  <label htmlFor="business-name" className="text-xs font-black uppercase tracking-[0.16em]">
                    Business name
                  </label>
                  <input
                    id="business-name"
                    name="businessName"
                    value={businessName}
                    onChange={(event) => setBusinessName(event.target.value)}
                    required
                    minLength={2}
                    maxLength={120}
                    className="h-12 border-2 border-black bg-white px-3 text-sm font-bold outline-none focus:ring-2 focus:ring-black"
                    placeholder="Your business"
                  />
                </div>

                <div className="grid gap-2">
                  <label htmlFor="business-use" className="text-xs font-black uppercase tracking-[0.16em]">
                    How are you planning to use Rearvy?
                  </label>
                  <textarea
                    id="business-use"
                    name="plannedUse"
                    value={businessUse}
                    onChange={(event) => setBusinessUse(event.target.value)}
                    required
                    minLength={10}
                    maxLength={1000}
                    className="min-h-32 resize-y border-2 border-black bg-white px-3 py-3 text-sm font-bold leading-6 outline-none focus:ring-2 focus:ring-black"
                    placeholder="Tell us what you want Rearvy to help your business with."
                  />
                </div>

                <div className="grid gap-2">
                  <label htmlFor="business-gmail" className="text-xs font-black uppercase tracking-[0.16em]">
                    Your Gmail
                  </label>
                  <input
                    id="business-gmail"
                    name="gmail"
                    type="email"
                    value={businessEmail}
                    onChange={(event) => setBusinessEmail(event.target.value)}
                    required
                    maxLength={160}
                    className="h-12 border-2 border-black bg-white px-3 text-sm font-bold outline-none focus:ring-2 focus:ring-black"
                    "use client";

                    import Image from "next/image";
                    import Link from "next/link";

                    export default function HomePage() {
                      return (
                        <main className="min-h-screen bg-[#06060a] text-white selection:bg-white selection:text-black">
                          <div className="mx-auto flex min-h-screen max-w-[1500px] items-center justify-between gap-8 px-6 py-16">
                            <div className="w-full max-w-2xl">
                              <p className="mb-4 inline-flex rounded-full bg-[#1b1b1f] px-3 py-1 text-sm font-semibold">New: Rearvy is now free to use</p>

                              <h1 className="mt-6 text-left font-poster text-[52px] leading-[1.02] sm:text-[76px] lg:text-[96px]">
                                Rearvy is an
                                <span className="block">OS-level business</span>
                                <span className="block">operating system.</span>
                              </h1>

                              <p className="mt-6 max-w-xl text-lg text-[#cfd2d8]">
                                Who can read, see, and execute better than you and your employees. Scale 10x easily with this free to use and first business executive platform.
                              </p>

                              <div className="mt-8 flex gap-4">
                                <Link href="/signup" className="rounded bg-white px-6 py-3 font-bold text-black">
                                  Start for free
                                </Link>
                                <Link href="/download" className="rounded border border-white px-6 py-3 font-semibold">
                                  Download
                                </Link>
                                <Link href="/docs" className="rounded px-6 py-3 font-semibold">
                                  Start building
                                </Link>
                              </div>

                              <div className="mt-6 flex items-center gap-4">
                                <div className="flex -space-x-2">
                                  <Image src="/rearvy-logo.png" alt="avatar" width={40} height={40} className="rounded-full border-2 border-white" />
                                  <Image src="/rearvy-logo.png" alt="avatar" width={40} height={40} className="rounded-full border-2 border-white" />
                                  <Image src="/rearvy-logo.png" alt="avatar" width={40} height={40} className="rounded-full border-2 border-white" />
                                </div>
                                <div className="text-sm text-[#9aa0a6]">Join operators building the future</div>
                              </div>
                            </div>

                            <div className="relative hidden w-1/2 rounded-2xl border-2 border-white bg-black p-2 shadow-[0_0_60px_rgba(99,102,241,0.6)] lg:block">
                              <div className="relative h-[520px] w-full overflow-hidden rounded-xl border-2 border-[#111] bg-[#0b0b0d]">
                                <Image src="/images/dashboard_mockup.png" alt="rearvy mockup" fill style={{ objectFit: 'contain' }} priority />
                              </div>
                            </div>
                          </div>
                        </main>
                      );
                    }
                <Link href="/download" className="campaign-button campaign-button-outline-invert h-12 px-5">
