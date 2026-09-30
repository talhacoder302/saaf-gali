import { ResidentShell } from "@/components/resident/resident-shell";
import { SECTION_ROLES } from "@/lib/roles";
import { requirePageUser } from "@/server/session";

export default async function ResidentLayout({ children }: { children: React.ReactNode }) {
  // The proxy already routes by role; this re-checks against the database.
  await requirePageUser(SECTION_ROLES["/resident"]);
  return <ResidentShell>{children}</ResidentShell>;
}
