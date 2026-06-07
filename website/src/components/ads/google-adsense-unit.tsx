"use client";

import { useEffect } from "react";

type GoogleAdSenseUnitProps = {
  className?: string;
  client?: string;
  format?: string;
  fullWidthResponsive?: boolean;
  slot: string;
};

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export function GoogleAdSenseUnit({
  className,
  client = "ca-pub-8353196926062457",
  format = "auto",
  fullWidthResponsive = true,
  slot,
}: GoogleAdSenseUnitProps) {
  useEffect(() => {
    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
    } catch {
      // AdSense can throw during local reloads or when the browser blocks ads.
    }
  }, []);

  return (
    <ins
      aria-label="Advertisement"
      className={["adsbygoogle", className].filter(Boolean).join(" ")}
      data-ad-client={client}
      data-ad-format={format}
      data-ad-slot={slot}
      data-full-width-responsive={fullWidthResponsive ? "true" : "false"}
      style={{ display: "block" }}
    />
  );
}
