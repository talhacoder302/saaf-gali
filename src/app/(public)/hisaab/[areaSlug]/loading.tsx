import { HisaabSkeleton } from "@/components/shared/hisaab/hisaab-skeleton";

export default function PublicHisaabLoading() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <HisaabSkeleton />
    </div>
  );
}
