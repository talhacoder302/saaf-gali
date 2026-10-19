"use client";

import { KeyRound, Pencil, UserCheck, UserX } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import type { AreaChoice } from "@/components/shared/area-checklist";
import { Button } from "@/components/ui/button";
import type { WorkerRow } from "@/server/workers";

import { WorkerFormDialog } from "./worker-form-dialog";
import { WorkerLoginDialog } from "./worker-login-dialog";
import { WorkerStatusDialog } from "./workers-view";

/** Edit, create login and mark as left, on the worker page. */
export function WorkerDetailActions({ worker, areas, today }: { worker: WorkerRow; areas: AreaChoice[]; today: string }) {
  const t = useTranslations("workers.actions");
  const [dialog, setDialog] = useState<"edit" | "status" | "login" | null>(null);
  const close = (open: boolean) => !open && setDialog(null);
  const active = worker.status === "active";

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => setDialog("edit")}>
        <Pencil aria-hidden />
        {t("edit")}
      </Button>
      {active && worker.mobile && !worker.login ? (
        <Button variant="outline" onClick={() => setDialog("login")}>
          <KeyRound aria-hidden />
          {t("createLogin")}
        </Button>
      ) : null}
      <Button variant={active ? "outline" : "default"} onClick={() => setDialog("status")}>
        {active ? <UserX aria-hidden /> : <UserCheck aria-hidden />}
        {active ? t("deactivate") : t("activate")}
      </Button>

      {dialog === "edit" ? <WorkerFormDialog open onOpenChange={close} worker={worker} areas={areas} today={today} /> : null}
      {dialog === "status" ? <WorkerStatusDialog worker={worker} onOpenChange={close} /> : null}
      {dialog === "login" && worker.mobile ? (
        <WorkerLoginDialog open onOpenChange={close} worker={{ id: worker.id, name: worker.name, mobile: worker.mobile }} />
      ) : null}
    </div>
  );
}
