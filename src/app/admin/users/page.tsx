import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { UsersView } from "@/components/admin/users/users-view";
import { ADMIN_ROLES, MANAGEABLE_ROLES } from "@/lib/roles";
import { listUsersSchema } from "@/lib/validators/users";
import { listAreaOptions } from "@/server/areas";
import { requirePageUser } from "@/server/session";
import { listUsers } from "@/server/users";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("users");
  return { title: t("title") };
}

type UsersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const actor = await requirePageUser(ADMIN_ROLES);
  const filters = listUsersSchema.parse(await searchParams);
  const [list, areas] = await Promise.all([listUsers(filters), listAreaOptions()]);

  return (
    <UsersView
      list={list}
      areas={areas}
      filters={{ q: filters.q ?? "", role: filters.role ?? null, status: filters.status ?? null }}
      actor={{ id: actor.id, role: actor.role, manageableRoles: [...MANAGEABLE_ROLES[actor.role]] }}
    />
  );
}
