"use client";

import { ImageIcon } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type PhotoViewerProps = {
  /** Null when the photo exists but cannot be shown (storage switched off). */
  url: string | null;
  /** Accessible name of the thumbnail button. */
  label: string;
  title: string;
  description?: string;
  missingLabel: string;
  className?: string;
};

/** A small thumbnail that opens the photo full size in a dialog. */
export function PhotoViewer({ url, label, title, description, missingLabel, className }: PhotoViewerProps) {
  const [open, setOpen] = useState(false);

  if (!url) {
    return (
      <span
        title={missingLabel}
        className={cn("flex size-12 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground", className)}
      >
        <ImageIcon className="size-5" aria-label={missingLabel} />
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        className={cn(
          "relative size-12 shrink-0 overflow-hidden rounded-lg border bg-muted outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          className,
        )}
      >
        {/* Pre-signed URLs change on every render, so image optimisation would only cache misses. */}
        <Image src={url} alt="" fill unoptimized sizes="48px" className="object-cover" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          <div className="relative h-[70dvh] w-full overflow-hidden rounded-lg bg-muted">
            <Image src={url} alt={description ?? title} fill unoptimized sizes="(min-width: 768px) 768px, 100vw" className="object-contain" />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
