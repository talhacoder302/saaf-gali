import { Skeleton } from "@/components/ui/skeleton";

export default function SupervisorExpensesLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-full" />
      </div>
      <Skeleton className="h-14 w-full rounded-lg" />
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-32 w-full rounded-2xl" />
      ))}
    </div>
  );
}
