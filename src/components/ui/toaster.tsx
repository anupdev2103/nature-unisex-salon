"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type ToastVariant = "default" | "success" | "error";
interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

const listeners = new Set<(t: ToastItem) => void>();
let counter = 0;

/** Fire a toast from anywhere (client components). */
export function toast(input: { title: string; description?: string; variant?: ToastVariant }) {
  const item: ToastItem = {
    id: ++counter,
    title: input.title,
    description: input.description,
    variant: input.variant ?? "default",
  };
  listeners.forEach((l) => l(item));
}

export function Toaster() {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  React.useEffect(() => {
    const onToast = (t: ToastItem) => {
      setItems((prev) => [...prev, t]);
      setTimeout(() => setItems((prev) => prev.filter((p) => p.id !== t.id)), 4000);
    };
    listeners.add(onToast);
    return () => {
      listeners.delete(onToast);
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            "rounded-lg border p-4 shadow-lg bg-card text-card-foreground animate-in slide-in-from-bottom-2",
            t.variant === "success" && "border-emerald-300 bg-emerald-50 text-emerald-900",
            t.variant === "error" && "border-destructive/40 bg-red-50 text-red-900",
          )}
          role="status"
        >
          <p className="text-sm font-semibold">{t.title}</p>
          {t.description ? <p className="mt-1 text-sm opacity-80">{t.description}</p> : null}
        </div>
      ))}
    </div>
  );
}
