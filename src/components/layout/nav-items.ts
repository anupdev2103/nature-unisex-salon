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

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

/** Single source of truth for navigation (desktop sidebar + mobile drawer). */
export const NAV: NavItem[] = [
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

export function navFor(role: "ADMIN" | "STAFF") {
  return NAV.filter((n) => !n.adminOnly || role === "ADMIN");
}
