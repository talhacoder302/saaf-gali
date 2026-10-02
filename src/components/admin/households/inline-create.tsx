"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { useErrorMessage } from "@/components/shared/use-error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/action-result";

type InlineCreateProps = {
  /** Link text, e.g. "New street". */
  label: string;
  placeholder: string;
  /** Saves the name; the action refreshes the page so the new item shows up in the list. */
  onCreate: (name: string) => Promise<ActionResult<{ id: string }>>;
  /** Called with the new id so the caller can select it. */
  onCreated: (id: string) => void;
  successMessage: string;
};

/**
 * A "+ New …" link that opens a one-line box inside another form. Its button
 * is type="button" and Enter is caught, so it never submits the outer form.
 */
export function InlineCreate({ label, placeholder, onCreate, onCreated, successMessage }: InlineCreateProps) {
  const tCommon = useTranslations("common");
  const tForm = useTranslations("households.form");
  const errorMessage = useErrorMessage();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    if (!name.trim()) {
      setError("required");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await onCreate(name.trim());
      if (!result.ok) {
        if (result.fieldErrors?.name) setError(result.fieldErrors.name);
        else toast.error(errorMessage(result.error));
        return;
      }
      toast.success(successMessage);
      onCreated(result.data.id);
      setName("");
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        <Plus className="size-3.5" aria-hidden />
        {label}
      </button>
    );
  }

  return (
    <div className="space-y-1.5 rounded-lg border bg-muted/40 p-2">
      <Input
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            save();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        aria-label={label}
        aria-invalid={Boolean(error)}
      />
      {error ? <p className="text-xs text-destructive">{errorMessage(error)}</p> : null}
      <div className="flex gap-1.5">
        <Button type="button" size="sm" onClick={save} disabled={isPending}>
          {isPending ? tCommon("saving") : tForm("add")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          {tCommon("cancel")}
        </Button>
      </div>
    </div>
  );
}
