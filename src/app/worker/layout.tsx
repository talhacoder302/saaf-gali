import { WorkerShell } from "@/components/worker/worker-shell";

export default function WorkerLayout({ children }: { children: React.ReactNode }) {
  return <WorkerShell>{children}</WorkerShell>;
}
