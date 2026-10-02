import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { MyExpensesView } from "@/components/supervisor/my-expenses-view";
import { SECTION_ROLES } from "@/lib/roles";
import { getExpenseFormOptions, listMyExpenses } from "@/server/expenses";
import { requirePageUser } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("expenses.mine");
  return { title: t("title") };
}

export default async function SupervisorExpensesPage() {
  await requirePageUser(SECTION_ROLES["/supervisor"]);
  const [options, expenses] = await Promise.all([getExpenseFormOptions(), listMyExpenses()]);
  return <MyExpensesView options={options} expenses={expenses} />;
}
