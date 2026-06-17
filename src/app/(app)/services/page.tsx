import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ServiceForm } from "@/components/services/service-form";
import { formatINR } from "@/lib/money";

export default async function ServicesPage() {
  await requireAdmin();
  const [services, categories] = await Promise.all([
    prisma.service.findMany({ where: { deletedAt: null }, include: { category: { select: { name: true } } }, orderBy: [{ isActive: "desc" }, { name: "asc" }] }),
    prisma.serviceCategory.findMany({ where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Services</h1><p className="text-muted-foreground">{services.length} services</p></div>
        <ServiceForm categories={categories} />
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Duration</TableHead><TableHead className="text-right">Price</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {services.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.category?.name ?? "—"}</TableCell>
                  <TableCell>{s.durationMin} min</TableCell>
                  <TableCell className="text-right">{formatINR(s.price)}</TableCell>
                  <TableCell><Badge variant={s.isActive ? "success" : "secondary"}>{s.isActive ? "Active" : "Disabled"}</Badge></TableCell>
                  <TableCell className="text-right">
                    <ServiceForm categories={categories} existing={{ id: s.id, name: s.name, categoryId: s.categoryId, price: s.price, durationMin: s.durationMin, isActive: s.isActive }} trigger={<Button variant="outline" size="sm">Edit</Button>} />
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
