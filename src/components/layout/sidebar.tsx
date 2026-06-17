"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  ReceiptText,
  Users,
  Scissors,
  CreditCard,
  Ticket,
  Building2,
  UserCog,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/billing", label: "Billing", icon: Receipt },
  { href: "/invoices", label: "Invoices", icon: ReceiptText },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/memberships", label: "Memberships", icon: CreditCard },
  { href: "/services", label: "Services", icon: Scissors, adminOnly: true },
  { href: "/coupons", label: "Coupons", icon: Ticket, adminOnly: true },
  { href: "/branches", label: "Branches", icon: Building2, adminOnly: true },
  { href: "/staff", label: "Staff", icon: UserCog, adminOnly: true },
  { href: "/reports", label: "Reports", icon: BarChart3, adminOnly: true },
  { href: "/settings", label: "Settings", icon: Settings, adminOnly: true },
];

export function Sidebar({ role }: { role: "ADMIN" | "STAFF" }) {
  const pathname = usePathname();
  const items = NAV.filter((n) => !n.adminOnly || role === "ADMIN");

  return (
    <aside className="hidden w-60 shrink-0 border-r bg-card md:flex md:flex-col">
      <div className="flex h-16 items-center gap-2 border-b px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
          N
        </div>
        <span className="font-semibold leading-tight">Nature Salon</span>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
