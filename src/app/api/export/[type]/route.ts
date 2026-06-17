import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getCurrentUser } from "@/lib/auth";
import { buildExport, type ExportType } from "@/server/queries/exports";

const VALID: ExportType[] = ["customers", "invoices", "memberships", "revenue", "staff"];

export async function GET(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { type } = await params;
  if (!VALID.includes(type as ExportType)) return NextResponse.json({ error: "Invalid export type" }, { status: 400 });

  const format = (req.nextUrl.searchParams.get("format") || "csv").toLowerCase();
  const table = await buildExport(type as ExportType);
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(type);
    ws.addRow(table.columns);
    ws.getRow(1).font = { bold: true };
    table.rows.forEach((r) => ws.addRow(r));
    ws.columns.forEach((col) => {
      let max = 10;
      col.eachCell?.({ includeEmpty: true }, (cell) => {
        max = Math.max(max, String(cell.value ?? "").length + 2);
      });
      col.width = Math.min(max, 40);
    });
    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(Buffer.from(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${table.filename}-${stamp}.xlsx"`,
      },
    });
  }

  // CSV (default)
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [table.columns.map(esc).join(","), ...table.rows.map((r) => r.map(esc).join(","))].join("\n");
  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${table.filename}-${stamp}.csv"`,
    },
  });
}
