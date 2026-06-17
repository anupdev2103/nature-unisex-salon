"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Receipt, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CustomerSearch } from "@/components/customers/customer-search";

export function StaffDashboard({ branchId }: { branchId: string | null }) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Quick actions</h1>
        <p className="text-muted-foreground">Find a customer or start a new bill</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer lookup</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomerSearch onSelect={(c) => router.push(`/customers/${c.id}`)} />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Button asChild size="lg" className="h-24 text-base">
          <Link href="/billing">
            <Receipt className="mr-2 h-5 w-5" /> New Bill
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-24 text-base">
          <Link href="/customers?new=1">
            <UserPlus className="mr-2 h-5 w-5" /> Register Customer
          </Link>
        </Button>
      </div>
    </div>
  );
}
