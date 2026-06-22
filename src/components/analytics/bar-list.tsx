/** Lightweight horizontal bar list — readable & fast, no chart dependency. */
export function BarList({
  items,
  empty = "No data",
}: {
  items: { label: string; value: number; display: string; sub?: string }[];
  empty?: string;
}) {
  if (items.length === 0) return <p className="py-4 text-sm text-muted-foreground">{empty}</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="space-y-2.5">
      {items.map((it) => (
        <div key={it.label}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate font-medium">{it.label}</span>
            <span className="shrink-0 tabular-nums">{it.display}{it.sub ? <span className="ml-1 text-xs text-muted-foreground">{it.sub}</span> : null}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(3, (it.value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
