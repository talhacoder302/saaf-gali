"use client";

import imageCompression from "browser-image-compression";
import { Camera, ImageOff, LoaderCircle, RefreshCw, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";

import { useErrorMessage } from "@/components/shared/use-error-message";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";
import {
  MAX_UPLOAD_BYTES,
  PHOTO_TARGET_KB,
  UPLOAD_CONTENT_TYPES,
  type UploadContentType,
  type UploadKind,
  type UploadTicket,
} from "@/lib/uploads";
import { cn } from "@/lib/utils";

/** A saved or freshly uploaded photo: the R2 key to store, and a URL to preview it. */
export type PhotoValue = { key: string; url: string | null };

type PhotoUploadProps = {
  kind: UploadKind;
  value: PhotoValue | null;
  onChange: (value: PhotoValue | null) => void;
  /** features.storage from the server. When false the component explains that saving without a photo is fine. */
  enabled: boolean;
  /** Keep PNG/WebP as they are (logos with transparency). Photos are turned into JPEG. */
  keepFormat?: boolean;
  /** Open the back camera straight away on phones. */
  capture?: boolean;
  /** Tell the parent form an upload is running, so it can hold the submit button. */
  onBusyChange?: (busy: boolean) => void;
  invalid?: boolean;
  id?: string;
  className?: string;
};

type Stage = "idle" | "compressing" | "uploading";

function isUploadType(type: string): type is UploadContentType {
  return (UPLOAD_CONTENT_TYPES as readonly string[]).includes(type);
}

/**
 * Pick a photo, shrink it in the browser to about 150 KB, and upload it
 * straight to R2 with a pre-signed URL from POST /api/uploads. The parent
 * form saves only the returned key; the server checks the key again.
 */
export function PhotoUpload({
  kind,
  value,
  onChange,
  enabled,
  keepFormat,
  capture,
  onBusyChange,
  invalid,
  id,
  className,
}: PhotoUploadProps) {
  const t = useTranslations("photoUpload");
  const errorMessage = useErrorMessage();
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const ownPreview = useRef<string | null>(null);

  // Free the local preview when it is replaced or the form closes.
  useEffect(() => {
    return () => {
      if (ownPreview.current) URL.revokeObjectURL(ownPreview.current);
    };
  }, []);

  function setBusy(next: Stage) {
    setStage(next);
    onBusyChange?.(next !== "idle");
  }

  async function upload(file: File) {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("photoWrongType");
      return;
    }
    try {
      setBusy("compressing");
      const compressed = await imageCompression(file, {
        maxSizeMB: PHOTO_TARGET_KB / 1024,
        maxWidthOrHeight: 1600,
        initialQuality: 0.8,
        // Runs on the page: the worker build would load the library from a CDN.
        useWebWorker: false,
        ...(keepFormat && isUploadType(file.type) ? {} : { fileType: "image/jpeg" }),
      });
      const contentType = isUploadType(compressed.type) ? compressed.type : "image/jpeg";
      if (compressed.size > MAX_UPLOAD_BYTES) {
        setError("photoTooLarge");
        return;
      }

      setBusy("uploading");
      const response = await fetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, contentType, size: compressed.size }),
      });
      const result = (await response.json()) as ActionResult<UploadTicket>;
      if (!result.ok) {
        setError(Object.values(result.fieldErrors ?? {})[0] ?? result.error);
        return;
      }

      const put = await fetch(result.data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": result.data.contentType },
        body: compressed,
      });
      if (!put.ok) {
        setError("photo_upload_failed");
        return;
      }

      if (ownPreview.current) URL.revokeObjectURL(ownPreview.current);
      ownPreview.current = URL.createObjectURL(compressed);
      onChange({ key: result.data.key, url: ownPreview.current });
    } catch (cause) {
      console.error("[photo-upload]", cause);
      setError("photo_upload_failed");
    } finally {
      setBusy("idle");
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (!enabled) {
    return (
      <div className={cn("flex items-start gap-3 rounded-lg border border-dashed p-3 text-sm text-muted-foreground", className)}>
        <ImageOff className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>{t("notConfigured")}</p>
      </div>
    );
  }

  const busy = stage !== "idle";

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        capture={capture ? "environment" : undefined}
        className="sr-only"
        disabled={busy}
        aria-invalid={invalid || Boolean(error)}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />

      {value ? (
        <div className="flex items-center gap-3">
          {value.url ? (
            <a
              href={value.url}
              target="_blank"
              rel="noreferrer"
              className="relative size-20 shrink-0 overflow-hidden rounded-lg border bg-muted"
              aria-label={t("view")}
            >
              <Image src={value.url} alt="" fill unoptimized sizes="80px" className="object-cover" />
            </a>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
              {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
              {busy ? t(stage) : t("change")}
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => onChange(null)}>
              <X aria-hidden />
              {t("remove")}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="h-auto w-full flex-col gap-1 border-dashed py-4"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <LoaderCircle className="size-6 animate-spin" aria-hidden /> : <Camera className="size-6" aria-hidden />}
          <span>{busy ? t(stage) : t("add")}</span>
        </Button>
      )}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage(error)}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
      )}
    </div>
  );
}
