import Image from "next/image";
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";

type NavLink = {
  href: string;
  label: string;
};

type HeroStat = {
  value: string;
  label: string;
};

type RearvyPublicShellProps = {
  className?: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  description: ReactNode;
  primaryCta?: {
    href: string;
    label: string;
    icon?: ComponentType<LucideProps>;
    download?: boolean;
  };
  secondaryCta?: {
    href: string;
    label: string;
    icon?: ComponentType<LucideProps>;
  };
  stats?: HeroStat[];
  sidePanel?: ReactNode;
  children?: ReactNode;
};

const publicNavLinks: NavLink[] = [
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
  { href: "/download", label: "Download" },
  { href: "/demo", label: "Demo" },
];

const primaryCtaClass =
  "inline-flex w-full max-w-[calc(100vw-48px)] items-center justify-center gap-2 rounded-[8px] bg-white px-6 py-3 font-semibold text-black shadow-sm shadow-black/20 transition hover:bg-cyan-50 max-sm:max-w-[342px] sm:w-auto";

const secondaryCtaClass =
  "inline-flex w-full max-w-[calc(100vw-48px)] items-center justify-center gap-2 rounded-[8px] border border-white/28 bg-white/[0.04] px-6 py-3 font-semibold text-white transition hover:border-white/55 hover:bg-white/10 max-sm:max-w-[342px] sm:w-auto";

function CtaIcon({ icon: Icon }: { icon?: ComponentType<LucideProps> }) {
  return Icon ? <Icon className="h-4 w-4" aria-hidden /> : null;
}

export function isInternalHref(href: string) {
  return href.startsWith("/") && !href.startsWith("//");
}

export function RearvyPublicShell({
  className,
  eyebrow,
  title,
  description,
  primaryCta,
  secondaryCta,
  stats,
  sidePanel,
  children,
}: RearvyPublicShellProps) {
  const hasSidePanel = Boolean(sidePanel);

  return (
    <main className={["rearvy-home-grid min-h-screen w-full overflow-hidden pb-16 text-white selection:bg-purple-300 selection:text-black", className].filter(Boolean).join(" ")}>
      <header className="fixed left-0 right-0 top-0 z-40">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-6 px-6 py-6">
          <Link href="/" aria-label="Rearvy home" className="flex items-center">
            <Image src="/rearvy-logo.png" alt="Rearvy" width={36} height={36} priority />
          </Link>

          <nav className="hidden items-center gap-5 text-sm font-semibold md:flex">
            {publicNavLinks.map((link) => (
              <Link key={link.href} href={link.href} className="opacity-90 transition hover:opacity-100">
                {link.label}
              </Link>
            ))}
            <Link href="/login" className="opacity-90 transition hover:opacity-100">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-[8px] bg-white px-4 py-2 font-semibold text-black shadow-sm shadow-black/15 transition hover:bg-cyan-50"
            >
              Sign up
            </Link>
          </nav>
        </div>
      </header>

      <section
        className={
          hasSidePanel
            ? "mx-auto grid min-h-[82svh] w-full max-w-[1500px] items-center gap-10 px-6 pb-12 pt-28 lg:grid-cols-[minmax(0,0.86fr)_minmax(420px,1fr)]"
            : "mx-auto flex min-h-[68svh] w-full max-w-[1500px] items-center px-6 pb-12 pt-28"
        }
      >
        <div className="min-w-0 w-full max-w-[calc(100vw-48px)] max-sm:max-w-[342px] sm:max-w-3xl">
          {eyebrow ? (
            <div className="mb-5 inline-flex items-center gap-2 rounded-[8px] border border-white/12 bg-white/8 px-3 py-1 text-xs font-medium text-white/74">
              {eyebrow}
            </div>
          ) : null}

          <h1 className="break-words font-poster text-[clamp(40px,8vw,104px)] leading-[0.92] text-white">
            {title}
          </h1>

          <p className="mt-6 max-w-xl break-words text-base font-medium leading-7 text-white/72 sm:text-lg">
            {description}
          </p>

          {(primaryCta || secondaryCta) && (
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
              {primaryCta ? (
                primaryCta.download || !isInternalHref(primaryCta.href) ? (
                  <a
                    href={primaryCta.href}
                    download={primaryCta.download}
                    className={primaryCtaClass}
                  >
                    {primaryCta.label}
                    <CtaIcon icon={primaryCta.icon} />
                  </a>
                ) : (
                  <Link
                    href={primaryCta.href}
                    className={primaryCtaClass}
                  >
                    {primaryCta.label}
                    <CtaIcon icon={primaryCta.icon} />
                  </Link>
                )
              ) : null}
              {secondaryCta ? (
                <Link
                  href={secondaryCta.href}
                  className={secondaryCtaClass}
                >
                  {secondaryCta.label}
                  <CtaIcon icon={secondaryCta.icon} />
                </Link>
              ) : null}
            </div>
          )}

          {stats?.length ? (
            <div className="mt-9 grid w-full max-w-2xl gap-3 sm:grid-cols-3">
              {stats.map((stat) => (
                <div key={`${stat.value}-${stat.label}`} className="min-w-0 rounded-[8px] border border-white/12 bg-white/7 p-4 backdrop-blur-xl">
                  <p className="break-words text-[22px] font-semibold leading-snug tracking-tight text-white">
                    {stat.value}
                  </p>
                  <p className="mt-2 text-xs font-medium text-white/58">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {hasSidePanel ? (
          <div className="min-w-0" aria-label="Rearvy page preview">
            {sidePanel}
          </div>
        ) : null}
      </section>

      {children ? <div className="relative z-10">{children}</div> : null}

      <footer className="relative z-10 mt-10 px-6 text-sm text-white/62">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 border-t border-white/12 py-8 md:flex-row md:items-center md:justify-between">
          <p>(c) 2026 Rearvy. All rights reserved.</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/privacy-policy" className="transition hover:text-white">
              Privacy
            </Link>
            <Link href="/terms" className="transition hover:text-white">
              Terms
            </Link>
            <Link href="/demo" className="transition hover:text-white">
              Demo
            </Link>
            <Link href="/contact" className="transition hover:text-white">
              Contact
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
