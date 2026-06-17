"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Search, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchCustomers, type CustomerHit } from "@/server/queries/customers";

export function CustomerSearch({
  onSelect,
  onAddNew,
  placeholder = "Search by name, phone, code or membership #",
}: {
  onSelect: (c: CustomerHit) => void;
  /** When provided, a "+ Add New Customer" row shows for any 2+ char term. */
  onAddNew?: (term: string) => void;
  placeholder?: string;
}) {
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<CustomerHit[]>([]);
  const [pending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);

  // Debounced search (250ms): only the latest in-flight request updates state,
  // so fast typing never floods the server or flickers stale results.
  function onChange(value: string) {
    setTerm(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setHits([]);
      return;
    }
    const myReq = ++reqId.current;
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const res = await searchCustomers(value);
        if (myReq === reqId.current) setHits(res);
      });
    }, 250);
  }

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={term}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9"
      />
      {(hits.length > 0 || (onAddNew && term.trim().length >= 2 && !pending)) && (
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
          {onAddNew && term.trim().length >= 2 && !pending ? (
            <li className={hits.length > 0 ? "border-t" : ""}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-primary hover:bg-accent"
                onClick={() => {
                  onAddNew(term.trim());
                  setTerm("");
                  setHits([]);
                }}
              >
                <UserPlus className="h-4 w-4" />
                Add New Customer{hits.length === 0 ? ` “${term.trim()}”` : ""}
              </button>
            </li>
          ) : null}
        </ul>
      )}
      {pending && term.length >= 2 && hits.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">Searching…</p>
      ) : null}
    </div>
  );
}
