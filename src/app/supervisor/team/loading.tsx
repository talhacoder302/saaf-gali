import { Skeleton } from "@/components/ui/skeleton";

export default function SupervisorTeamLoading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-2xl" />
      ))}
    </div>
  );
}
