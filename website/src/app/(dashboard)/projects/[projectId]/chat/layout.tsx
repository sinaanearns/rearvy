import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Chat",
};

export default function ProjectChatLayout({ children }: { children: ReactNode }) {
  return children;
}
