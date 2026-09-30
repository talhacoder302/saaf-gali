"use client";

import { UserMinus, UserPlus, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { assignTeamMemberAction, removeTeamMemberAction } from "@/app/admin/areas/actions";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useErrorMessage } from "@/components/shared/use-error-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TEAM_ROLES, type TeamRole } from "@/lib/areas";
import { formatMobile } from "@/lib/mobile";

import type { AreaTeam, TeamCandidate, TeamMember } from "./types";

type TeamTabProps = {
  areaId: string;
  team: AreaTeam;
};

function AddMember({ areaId, role, candidates }: { areaId: string; role: TeamRole; candidates: TeamCandidate[] }) {
  const t = useTranslations("team");
  const errorMessage = useErrorMessage();
  const [userId, setUserId] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  if (candidates.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noCandidates")}</p>;
  }

  function add() {
    if (!userId) return;
    startTransition(async () => {
      const result = await assignTeamMemberAction({ areaId, userId });
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(t("added"));
      setUserId("");
    });
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Select value={userId} onValueChange={setUserId}>
        <SelectTrigger className="w-full sm:flex-1" aria-label={t(`addLabel.${role}`)}>
          <SelectValue placeholder={t(`addLabel.${role}`)} />
        </SelectTrigger>
        <SelectContent>
          {candidates.map((candidate) => (
            <SelectItem key={candidate.id} value={candidate.id}>
              {candidate.name} · <span dir="ltr">{formatMobile(candidate.mobile)}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="button" onClick={add} disabled={!userId || isPending}>
        <UserPlus aria-hidden />
        {t("add")}
      </Button>
    </div>
  );
}

export function TeamTab({ areaId, team }: TeamTabProps) {
  const t = useTranslations("team");
  const tUsers = useTranslations("users");
  const [removing, setRemoving] = useState<TeamMember | null>(null);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {TEAM_ROLES.map((role) => {
        const members = team.members[role];
        const canManage = team.manageableRoles.includes(role);
        return (
          <Card key={role}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span>{t(`roles.${role}`)}</span>
                <Badge variant="secondary" className="tabular-nums">
                  {members.length}
                </Badge>
              </CardTitle>
              <CardDescription>{t(`hints.${role}`)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {members.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                  <Users className="size-4" aria-hidden />
                  {t("none")}
                </div>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {members.map((member) => (
                    <li key={member.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{member.name}</p>
                        <p dir="ltr" className="text-start text-xs text-muted-foreground">
                          {formatMobile(member.mobile)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {member.status === "disabled" ? (
                          <Badge variant="outline" className="text-muted-foreground">
                            {tUsers("status.disabled")}
                          </Badge>
                        ) : null}
                        {canManage ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setRemoving(member)}
                            aria-label={t("removeFor", { name: member.name })}
                          >
                            <UserMinus />
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {canManage ? <AddMember areaId={areaId} role={role} candidates={team.candidates[role]} /> : null}
            </CardContent>
          </Card>
        );
      })}

      {removing ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setRemoving(null)}
          title={t("removeTitle", { name: removing.name })}
          description={removing.role === "supervisor" ? t("removeBodySupervisor") : t("removeBody")}
          confirmLabel={t("remove")}
          destructive
          successMessage={t("removed")}
          onConfirm={() => removeTeamMemberAction({ areaId, userId: removing.id })}
        />
      ) : null}
    </div>
  );
}
