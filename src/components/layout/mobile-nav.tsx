"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { navFor } from "./nav-items";

/** Hamburger + slide-in drawer nav for phones/tablets (hidden on md+). */
export function MobileNav({ role }: { role: "ADMIN" | "STAFF" }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = navFor(role);

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        className="inline-flex h-10 w-10 items-center justify-center rounded-md border md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out md:hidden" />
        <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85%] flex-col border-r bg-card shadow-xl outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-left md:hidden">
          <div className="flex h-16 items-center justify-between border-b px-4">
            <DialogPrimitive.Title className="flex items-center gap-2 font-semibold">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground">N</span>
              Nature Salon
            </DialogPrimitive.Title>
            <DialogPrimitive.Close className="rounded-md p-1 hover:bg-accent" aria-label="Close menu">
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto p-3">
            {items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
