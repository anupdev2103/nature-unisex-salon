import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CustomerForm } from "@/components/customers/customer-form";
import { formatDate } from "@/lib/utils";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; new?: string }>;
}) {
  const user = await requireUser();
  const { q, new: openNew } = await searchParams;

  const [branches, customers] = await Promise.all([
    prisma.branch.findMany({ where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.customer.findMany({
      where: {
        deletedAt: null,
        ...(q
          ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { customerCode: { contains: q, mode: "insensitive" } }] }
          : {}),
      },
      include: { registeredBranch: { select: { name: true } }, _count: { select: { invoices: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">{customers.length} shown</p>
        </div>
        <CustomerForm branches={branches} defaultBranchId={user.branchId ?? undefined} defaultOpen={openNew === "1"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <form className="flex gap-2">
              <input
                name="q"
                defaultValue={q}
                placeholder="Search name, phone or code…"
                className="h-9 w-full max-w-sm rounded-md border border-input bg-background px-3 text-sm"
              />
            </form>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Visits</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No customers found.</TableCell></TableRow>
              ) : (
                customers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.customerCode}</TableCell>
                    <TableCell>
                      <Link href={`/customers/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                    </TableCell>
                    <TableCell>{c.phone}</TableCell>
                    <TableCell>{c.registeredBranch.name}</TableCell>
                    <TableCell>{c._count.invoices}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === "ACTIVE" ? "success" : c.status === "BLOCKED" ? "destructive" : "secondary"}>
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(c.createdAt)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
