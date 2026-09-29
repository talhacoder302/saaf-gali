"use client";

import { ErrorState } from "@/components/shared/error-state";

export default function RootError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <ErrorState {...props} />
    </div>
  );
}
