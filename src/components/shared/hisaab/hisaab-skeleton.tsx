import { Skeleton } from "@/components/ui/skeleton";

/** Loading state for every hisaab page; follows the container width like the real view. */
export function HisaabSkeleton() {
  return (
    <div className="@container space-y-6" aria-busy="true">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="hidden h-9 w-36 @2xl:block" />
      </div>
      <Skeleton className="h-9 w-full @2xl:max-w-xs" />
      <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 @3xl:grid-cols-2">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
      <Skeleton className="h-72 rounded-xl" />
      <div className="space-y-2 rounded-xl border bg-card p-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
