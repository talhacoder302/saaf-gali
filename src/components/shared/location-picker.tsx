"use client";

import { ExternalLink, LocateFixed, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mapLink } from "@/lib/areas";

export type LatLng = { lat: number; lng: number };

type LocationPickerProps = {
  value: LatLng | null;
  onChange: (value: LatLng | null) => void;
  invalid?: boolean;
  idPrefix?: string;
};

function round(value: number): number {
  // 6 decimals is about 10 cm, more than enough for a street.
  return Math.round(value * 1e6) / 1e6;
}

/**
 * Pick a point with the phone's GPS ("use my current location") or by typing
 * coordinates. No map API: the result links to OpenStreetMap to check it.
 */
export function LocationPicker({ value, onChange, invalid, idPrefix = "location" }: LocationPickerProps) {
  const t = useTranslations("location");
  const [lat, setLat] = useState(value ? String(value.lat) : "");
  const [lng, setLng] = useState(value ? String(value.lng) : "");
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // The text boxes own what is typed (so "33." survives); `value` is only read at mount.
  function emit(nextLat: string, nextLng: string) {
    setLat(nextLat);
    setLng(nextLng);
    if (nextLat.trim() === "" && nextLng.trim() === "") {
      onChange(null);
      return;
    }
    const parsedLat = Number(nextLat);
    const parsedLng = Number(nextLng);
    // Pass NaN through so the form's validation can flag a half-filled pair.
    onChange({
      lat: nextLat.trim() === "" ? Number.NaN : parsedLat,
      lng: nextLng.trim() === "" ? Number.NaN : parsedLng,
    });
  }

  function useCurrentLocation() {
    if (!("geolocation" in navigator)) {
      setMessage(t("unsupported"));
      return;
    }
    setLocating(true);
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const point = { lat: round(position.coords.latitude), lng: round(position.coords.longitude) };
        emit(String(point.lat), String(point.lng));
        setMessage(t("accuracy", { meters: Math.round(position.coords.accuracy) }));
      },
      (error) => {
        setLocating(false);
        setMessage(error.code === error.PERMISSION_DENIED ? t("denied") : t("failed"));
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  const hasPoint = value !== null && Number.isFinite(value.lat) && Number.isFinite(value.lng);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={useCurrentLocation} disabled={locating}>
          <LocateFixed aria-hidden />
          {locating ? t("locating") : t("useCurrent")}
        </Button>
        {hasPoint ? (
          <>
            <Button asChild type="button" variant="ghost">
              <a href={mapLink(value.lat, value.lng)} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden />
                {t("openMap")}
              </a>
            </Button>
            <Button type="button" variant="ghost" onClick={() => emit("", "")}>
              <X aria-hidden />
              {t("clear")}
            </Button>
          </>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-lat`} className="text-xs text-muted-foreground">
            {t("latitude")}
          </Label>
          <Input
            id={`${idPrefix}-lat`}
            inputMode="decimal"
            dir="ltr"
            placeholder="33.6340"
            value={lat}
            onChange={(event) => emit(event.target.value, lng)}
            aria-invalid={invalid}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-lng`} className="text-xs text-muted-foreground">
            {t("longitude")}
          </Label>
          <Input
            id={`${idPrefix}-lng`}
            inputMode="decimal"
            dir="ltr"
            placeholder="73.0680"
            value={lng}
            onChange={(event) => emit(lat, event.target.value)}
            aria-invalid={invalid}
          />
        </div>
      </div>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
