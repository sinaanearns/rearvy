import Image from "next/image";

import { cn } from "@/lib/utils";

type RearvyLogoProps = {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  markOnly?: boolean;
  markSize?: number;
  priority?: boolean;
  variant?: "light" | "dark";
};

export function RearvyLogo({
  className,
  markClassName,
  textClassName,
  markOnly = false,
  markSize = 32,
  priority = false,
  variant = "light",
}: RearvyLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Image
        src={
          variant === "dark"
            ? "/rearvy-logo.png?v=20260522c"
            : "/favicon.png?v=20260522c"
        }
        alt={markOnly ? "Rearvy" : ""}
        width={markSize}
        height={markSize}
        className={cn("shrink-0 rounded-lg object-cover", markClassName)}
        priority={priority}
      />
      {!markOnly && (
        <span className={cn("font-bold tracking-normal", textClassName)}>
          Rearvy
        </span>
      )}
    </span>
  );
}
