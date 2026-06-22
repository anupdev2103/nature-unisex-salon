"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { RangePreset } from "@/server/queries/analytics";

const PRESETS: { key: RangePreset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "this_week", label: "This Week" },
  { key: "last_week", label: "Last Week" },
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "last_3_months", label: "Last 3 Months" },
  { key: "this_year", label: "This Year" },
];

/** Universal date filter — writes ?preset / ?from / ?to to the URL. */
export function DateRangeFilter({ preset, from, to }: { preset: RangePreset; from?: string; to?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [customOpen, setCustomOpen] = useState(preset === "custom");

  function go(patch: Record<string, string | undefined>) {
    const sp = new URLSearchParams(params.toString());
    Object.entries(patch).forEach(([k, v]) => (v ? sp.set(k, v) : sp.delete(k)));
    router.push(`${pathname}?${sp.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => { setCustomOpen(false); go({ preset: p.key, from: undefined, to: undefined }); }}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors sm:text-sm",
              preset === p.key ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
            )}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setCustomOpen((v) => !v)}
          className={cn(
            "flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors sm:text-sm",
            preset === "custom" ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
          )}
        >
          <Calendar className="h-3.5 w-3.5" /> Custom
        </button>
      </div>

      {customOpen && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            go({ preset: "custom", from: String(f.get("from") || ""), to: String(f.get("to") || "") });
          }}
        >
          <input name="from" type="date" defaultValue={from} className="h-9 rounded-md border border-input bg-background px-2 text-sm" required />
          <span className="text-muted-foreground">to</span>
          <input name="to" type="date" defaultValue={to} className="h-9 rounded-md border border-input bg-background px-2 text-sm" required />
          <Button type="submit" size="sm" variant="outline">Apply</Button>
        </form>
      )}
    </div>
  );
}
