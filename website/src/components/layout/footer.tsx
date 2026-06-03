"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Footer() {
  const pathname = usePathname();

  if (pathname !== "/") {
    return null;
  }

  return (
    <footer className="mt-8 hidden w-full border-t border-white/10 py-6 text-white md:block">
      <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <nav className="flex gap-4 text-sm">
          <Link href="/privacy-policy" className="text-white/62 hover:underline">Privacy</Link>
          <Link href="/terms" className="text-white/62 hover:underline">Terms</Link>
          <Link href="/security" className="text-white/62 hover:underline">Security</Link>
        </nav>
      </div>
    </footer>
  );
}
