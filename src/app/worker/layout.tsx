import { WorkerShell } from "@/components/worker/worker-shell";
import { SECTION_ROLES } from "@/lib/roles";
import { requirePageUser } from "@/server/session";

export default async function WorkerLayout({ children }: { children: React.ReactNode }) {
  // The proxy already routes by role; this re-checks against the database.
  await requirePageUser(SECTION_ROLES["/worker"]);
  return <WorkerShell>{children}</WorkerShell>;
}
