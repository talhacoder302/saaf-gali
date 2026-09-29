import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ActionTileProps = {
  icon: LucideIcon;
  label: string;
  /** Leave out for features that are not built yet; the tile shows a "Soon" badge. */
  href?: string;
  soonLabel: string;
  primary?: boolean;
};

/** Big, icon-first button for worker, supervisor and resident home screens. */
export function ActionTile({ icon: Icon, label, href, soonLabel, primary }: ActionTileProps) {
  const content = (
    <>
      <Icon className="size-9" aria-hidden />
      <span className="text-base font-medium">{label}</span>
      {href ? null : (
        <Badge variant="secondary" className="absolute end-2 top-2">
          {soonLabel}
        </Badge>
      )}
    </>
  );

  const classes = cn(
    "relative flex min-h-32 flex-col items-center justify-center gap-2 rounded-2xl border p-4 text-center transition-colors",
    primary ? "bg-primary text-primary-foreground" : "bg-card",
    href ? "hover:border-primary active:scale-[0.98]" : "cursor-not-allowed opacity-70",
  );

  if (!href) {
    return (
      <div className={classes} aria-disabled="true">
        {content}
      </div>
    );
  }

  return (
    <Link href={href} className={classes}>
      {content}
    </Link>
  );
}
