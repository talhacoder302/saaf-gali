"use client";

import { ErrorState } from "@/components/shared/error-state";

export default function AdminError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorState {...props} />;
}
