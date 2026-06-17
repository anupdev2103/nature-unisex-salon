import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StaffForm } from "@/components/staff/staff-form";
import { StaffStatusToggle } from "@/components/staff/staff-status-toggle";

export default async function StaffPage() {
  const me = await requireAdmin();
  const [users, branches] = await Promise.all([
    prisma.user.findMany({
      where: { deletedAt: null },
      include: { branch: { select: { name: true } }, _count: { select: { invoicesAsStaff: true } } },
      orderBy: [{ role: "asc" }, { fullName: "asc" }],
    }),
    prisma.branch.findMany({ where: { deletedAt: null }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Staff & Admins</h1><p className="text-muted-foreground">{users.length} logins</p></div>
        <StaffForm branches={branches} />
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Branch</TableHead><TableHead>Invoices</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.fullName}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell><Badge variant={u.role === "ADMIN" ? "default" : "secondary"}>{u.role}</Badge></TableCell>
                  <TableCell>{u.branch?.name ?? "All"}</TableCell>
                  <TableCell>{u._count.invoicesAsStaff}</TableCell>
                  <TableCell><Badge variant={u.status === "ACTIVE" ? "success" : "destructive"}>{u.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    {u.id === me.id ? <span className="text-xs text-muted-foreground">You</span> : <StaffStatusToggle id={u.id} status={u.status as "ACTIVE" | "DISABLED"} />}
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
