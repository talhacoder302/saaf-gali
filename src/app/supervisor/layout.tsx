import { SupervisorShell } from "@/components/supervisor/supervisor-shell";

export default function SupervisorLayout({ children }: { children: React.ReactNode }) {
  return <SupervisorShell>{children}</SupervisorShell>;
}
