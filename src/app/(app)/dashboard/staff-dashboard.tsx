"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Receipt, UserPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CustomerSearch } from "@/components/customers/customer-search";

/** Compact quick-actions island for the receptionist dashboard. */
export function StaffQuickActions() {
  const router = useRouter();
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <CustomerSearch
          placeholder="Search customer by mobile, name or ID…"
          onSelect={(c) => router.push(`/customers/${c.id}`)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Button asChild size="lg" className="h-14 text-base">
            <Link href="/billing"><Receipt className="mr-2 h-5 w-5" /> New Bill</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-14 text-base">
            <Link href="/customers?new=1"><UserPlus className="mr-2 h-5 w-5" /> Register Customer</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
