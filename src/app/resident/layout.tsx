import { ResidentShell } from "@/components/resident/resident-shell";

export default function ResidentLayout({ children }: { children: React.ReactNode }) {
  return <ResidentShell>{children}</ResidentShell>;
}
