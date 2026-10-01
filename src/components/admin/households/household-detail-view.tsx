"use client";

import { ArrowLeft, Banknote, KeyRound, MessageSquareWarning, Pencil, UserRound } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRupees } from "@/lib/format";
import { isBillable } from "@/lib/households";
import { formatMobile } from "@/lib/mobile";

import { HouseholdFormDialog } from "./household-form-dialog";
import { STATUS_BADGE } from "./households-view";
import { ResidentLoginDialog } from "./resident-login-dialog";
import type { AreaNode, HouseholdDetail } from "./types";

type HouseholdDetailViewProps = {
  household: HouseholdDetail;
  tree: AreaNode[];
};

export function HouseholdDetailView({ household, tree }: HouseholdDetailViewProps) {
  const t = useTranslations("households");
  const tUsers = useTranslations("users");
  const format = useFormatter();
  const [dialog, setDialog] = useState<"edit" | "resident" | null>(null);
  const readOnly = household.areaArchived;
  const canCreateResident = !readOnly && Boolean(household.mobile) && household.residents.length === 0;

  const details: { label: string; value: React.ReactNode }[] = [
    { label: t("detail.owner"), value: household.ownerName },
    { label: t("detail.occupant"), value: t(`occupant.${household.occupantType}`) },
    { label: t("detail.contact"), value: household.contactName ?? "—" },
    {
      label: t("detail.mobile"),
      value: household.mobile ? (
        <span dir="ltr" className="font-mono">
          {formatMobile(household.mobile)}
        </span>
      ) : (
        "—"
      ),
    },
    { label: t("detail.email"), value: household.email ? <span dir="ltr">{household.email}</span> : "—" },
    {
      label: t("detail.fee"),
      value: (
        <span>
          {formatRupees(household.monthlyFee)}
          {household.monthlyFee !== household.areaDefaultFee ? (
            <span className="ms-2 text-xs text-muted-foreground">
              {t("detail.customFee", { fee: formatRupees(household.areaDefaultFee) })}
            </span>
          ) : null}
        </span>
      ),
    },
    { label: t("detail.notes"), value: household.notes ?? "—" },
    { label: t("detail.added"), value: format.dateTime(new Date(household.createdAt), { dateStyle: "medium" }) },
  ];

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ms-2">
        <Link href="/admin/households">
          <ArrowLeft aria-hidden className="rtl:-scale-x-100" />
          {t("backToList")}
        </Link>
      </Button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{t("houseLabel", { number: household.houseNumber })}</h1>
            <Badge variant={STATUS_BADGE[household.status]}>{t(`status.${household.status}`)}</Badge>
          </div>
          <p className="text-muted-foreground">
            {household.streetName} · {household.blockName} ·{" "}
            <Link href={`/admin/areas/${household.areaId}`} className="hover:underline">
              {household.areaName}
            </Link>
          </p>
        </div>
        {readOnly ? null : (
          <div className="flex flex-wrap gap-2">
            {canCreateResident ? (
              <Button variant="outline" onClick={() => setDialog("resident")}>
                <KeyRound aria-hidden />
                {t("residentLogin.open")}
              </Button>
            ) : null}
            <Button onClick={() => setDialog("edit")}>
              <Pencil aria-hidden />
              {t("edit")}
            </Button>
          </div>
        )}
      </div>

      {!isBillable(household.status) ? (
        <p role="status" className="rounded-lg border border-dashed bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          {t(`notBilled.${household.status === "vacant" ? "vacant" : "exempt"}`)}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("detail.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[auto_1fr]">
              {details.map((item) => (
                <div key={item.label} className="contents">
                  <dt className="text-muted-foreground">{item.label}</dt>
                  <dd className="font-medium">{item.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="size-5 text-primary" aria-hidden />
              {t("residents.title")}
            </CardTitle>
            <CardDescription>{t("residents.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            {household.residents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {household.mobile ? t("residents.none") : t("residents.needMobile")}
              </p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {household.residents.map((resident) => (
                  <li key={resident.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <div>
                      <p className="font-medium">{resident.name}</p>
                      <p dir="ltr" className="text-start text-xs text-muted-foreground">
                        {formatMobile(resident.mobile)}
                      </p>
                    </div>
                    {resident.status === "disabled" ? (
                      <Badge variant="outline">{tUsers("status.disabled")}</Badge>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("feeHistory.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState icon={Banknote} title={t("feeHistory.emptyTitle")} description={t("feeHistory.emptyBody")} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("complaints.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={MessageSquareWarning}
              title={t("complaints.emptyTitle")}
              description={t("complaints.emptyBody")}
            />
          </CardContent>
        </Card>
      </div>

      {dialog === "edit" ? (
        <HouseholdFormDialog open onOpenChange={(open) => !open && setDialog(null)} tree={tree} household={household} />
      ) : null}
      {dialog === "resident" && household.mobile ? (
        <ResidentLoginDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          householdId={household.id}
          name={household.contactName ?? household.ownerName}
          mobile={household.mobile}
        />
      ) : null}
    </div>
  );
}
