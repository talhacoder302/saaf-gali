"use client";

import { ErrorState } from "@/components/shared/error-state";

export default function ResidentError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorState {...props} />;
}
