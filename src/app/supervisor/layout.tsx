import { SupervisorShell } from "@/components/supervisor/supervisor-shell";
import { SECTION_ROLES } from "@/lib/roles";
import { requirePageUser } from "@/server/session";

export default async function SupervisorLayout({ children }: { children: React.ReactNode }) {
  // The proxy already routes by role; this re-checks against the database.
  await requirePageUser(SECTION_ROLES["/supervisor"]);
  return <SupervisorShell>{children}</SupervisorShell>;
}
