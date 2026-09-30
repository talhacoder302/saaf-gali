import { AdminShell } from "@/components/admin/admin-shell";
import { SECTION_ROLES } from "@/lib/roles";
import { requirePageUser } from "@/server/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // The proxy already routes by role; this re-checks against the database.
  const user = await requirePageUser(SECTION_ROLES["/admin"]);
  return <AdminShell user={{ name: user.name, role: user.role }}>{children}</AdminShell>;
}
