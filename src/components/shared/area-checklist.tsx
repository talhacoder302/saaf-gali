"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type AreaChoice = { id: string; name: string; city: string };

type AreaChecklistProps = {
  areas: AreaChoice[];
  value: string[];
  onChange: (value: string[]) => void;
  /** Picking an area replaces the previous one (residents). */
  single?: boolean;
  invalid?: boolean;
  idPrefix?: string;
};

/** Areas grouped by city with a checkbox each. */
export function AreaChecklist({ areas, value, onChange, single, invalid, idPrefix = "area" }: AreaChecklistProps) {
  const cities = [...new Set(areas.map((area) => area.city))];

  function toggle(id: string, checked: boolean) {
    if (single) {
      onChange(checked ? [id] : []);
      return;
    }
    onChange(checked ? [...value, id] : value.filter((existing) => existing !== id));
  }

  return (
    <div
      className={cn(
        "max-h-56 space-y-3 overflow-y-auto rounded-lg border p-3",
        invalid && "border-destructive",
      )}
    >
      {cities.map((city) => (
        <div key={city} className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{city}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {areas
              .filter((area) => area.city === city)
              .map((area) => {
                const id = `${idPrefix}-${area.id}`;
                return (
                  <div key={area.id} className="flex items-center gap-2">
                    <Checkbox
                      id={id}
                      checked={value.includes(area.id)}
                      onCheckedChange={(checked) => toggle(area.id, checked === true)}
                    />
                    <Label htmlFor={id} className="font-normal">
                      {area.name}
                    </Label>
                  </div>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}
