"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const footerLinks = [
  { href: "/privacy-policy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/demo", label: "Demo" },
  { href: "/contact", label: "Contact" },
];

export default function Footer() {
  const pathname = usePathname();

  if (pathname !== "/") {
    return null;
  }

  return (
    <footer className="relative z-10 w-full border-t border-white/10 bg-[#030405] text-white">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-4 px-5 py-8 text-sm text-white/62 sm:px-6 md:flex-row md:items-center md:justify-between">
        <p>(c) 2026 Rearvy. All rights reserved.</p>
        <nav aria-label="Homepage legal links" className="flex flex-wrap gap-x-5 gap-y-2">
          {footerLinks.map((link) => (
            <Link key={link.href} href={link.href} className="transition hover:text-white">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
