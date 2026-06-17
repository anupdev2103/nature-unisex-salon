import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BranchForm } from "@/components/branches/branch-form";

export default async function BranchesPage() {
  await requireAdmin();
  const branches = await prisma.branch.findMany({
    where: { deletedAt: null },
    include: { _count: { select: { invoices: true, customers: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Branches</h1><p className="text-muted-foreground">{branches.length} branches</p></div>
        <BranchForm />
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Customers</TableHead><TableHead>Invoices</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {branches.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell className="font-mono text-xs">{b.code}</TableCell>
                  <TableCell>{b._count.customers}</TableCell>
                  <TableCell>{b._count.invoices}</TableCell>
                  <TableCell><Badge variant={b.isActive ? "success" : "secondary"}>{b.isActive ? "Active" : "Disabled"}</Badge></TableCell>
                  <TableCell className="text-right">
                    <BranchForm existing={{ id: b.id, name: b.name, code: b.code, address: b.address, phone: b.phone, isActive: b.isActive }} trigger={<Button variant="outline" size="sm">Edit</Button>} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
