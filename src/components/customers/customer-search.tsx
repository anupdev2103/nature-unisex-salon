"use client";

import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchCustomers, type CustomerHit } from "@/server/queries/customers";

export function CustomerSearch({
  onSelect,
  placeholder = "Search by name, phone, code or membership #",
}: {
  onSelect: (c: CustomerHit) => void;
  placeholder?: string;
}) {
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<CustomerHit[]>([]);
  const [pending, startTransition] = useTransition();

  function onChange(value: string) {
    setTerm(value);
    if (value.trim().length < 2) {
      setHits([]);
      return;
    }
    startTransition(async () => setHits(await searchCustomers(value)));
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={term}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9"
      />
      {hits.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-lg">
          {hits.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => {
                  onSelect(c);
                  setTerm("");
                  setHits([]);
                }}
              >
                <span>
                  <span className="font-medium">{c.name}</span>
                  <span className="ml-2 text-muted-foreground">{c.phone}</span>
                </span>
                <span className="text-xs text-muted-foreground">{c.customerCode}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {pending && term.length >= 2 && hits.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">Searching…</p>
      ) : null}
    </div>
  );
}
