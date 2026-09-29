"use client";

import { Direction } from "radix-ui";

import { Toaster } from "@/components/ui/sonner";

type ProvidersProps = {
  dir: "ltr" | "rtl";
  children: React.ReactNode;
};

/** Client-side providers shared by every page. */
export function Providers({ dir, children }: ProvidersProps) {
  return (
    <Direction.DirectionProvider dir={dir}>
      {children}
      <Toaster dir={dir} position={dir === "rtl" ? "top-left" : "top-right"} richColors />
    </Direction.DirectionProvider>
  );
}
