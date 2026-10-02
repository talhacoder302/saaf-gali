import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ExpensesView } from "@/components/admin/expenses/expenses-view";
import { ADMIN_ROLES } from "@/lib/roles";
import { listExpensesSchema } from "@/lib/validators/expenses";
import { listAreaFilterOptions } from "@/server/areas";
import { expenseFilterMonths, getExpenseFormOptions, listExpenses } from "@/server/expenses";
import { requirePageUser } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("expenses");
  return { title: t("title") };
}

type ExpensesPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  await requirePageUser(ADMIN_ROLES);
  const filters = listExpensesSchema.parse(await searchParams);
  const [list, options, areas] = await Promise.all([listExpenses(filters), getExpenseFormOptions(), listAreaFilterOptions()]);

  return (
    <ExpensesView
      list={list}
      options={options}
      months={expenseFilterMonths()}
      filterAreas={areas.map((area) => ({ id: area.id, name: area.name }))}
      filters={{
        areaId: filters.areaId ?? null,
        month: list.month,
        category: filters.category ?? null,
        status: filters.status ?? null,
      }}
    />
  );
}
