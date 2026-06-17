import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { buildInvoicePdf } from "@/lib/invoice-pdf";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "salon-assets";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      items: true,
      branch: { select: { name: true } },
      staff: { select: { fullName: true } },
    },
  });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const settings = await prisma.setting.findUnique({ where: { id: "global" } });

  const bytes = await buildInvoicePdf({
    invoiceNumber: invoice.invoiceNumber,
    createdAt: invoice.createdAt,
    salonName: settings?.salonName ?? "Nature Unisex Salon",
    gstNumber: settings?.gstNumber,
    address: settings?.address,
    phone: settings?.whatsappNumber,
    branchName: invoice.branch.name,
    customerName: invoice.customerNameSnapshot,
    customerPhone: invoice.customerPhoneSnapshot,
    staffName: invoice.staff.fullName,
    items: invoice.items.map((it) => ({
      name: it.serviceNameSnapshot,
      qty: it.quantity,
      unitPrice: it.unitPriceSnapshot,
      lineTotal: it.lineTotal,
      benefit: it.membershipBenefit,
    })),
    subtotal: invoice.subtotal,
    itemDiscountTotal: invoice.itemDiscountTotal,
    billDiscountTotal: invoice.billDiscountTotal,
    couponTotal: invoice.couponTotal,
    membershipApplied: invoice.membershipApplied,
    taxAmount: invoice.taxAmount,
    taxRatePctBps: invoice.taxRatePctBps,
    grandTotal: invoice.grandTotal,
    paymentMethod: invoice.paymentMethod,
  });

  // Persist to storage + save URL (best-effort; never blocks the download).
  try {
    const supabase = createSupabaseAdminClient();
    const path = `invoices/${invoice.invoiceNumber.replace(/[\/]/g, "-")}.pdf`;
    await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: "application/pdf", upsert: true });
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    if (data?.publicUrl && data.publicUrl !== invoice.pdfUrl) {
      await prisma.invoice.update({ where: { id: invoice.id }, data: { pdfUrl: data.publicUrl } });
    }
  } catch {
    // storage not configured — still return the generated PDF
  }

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.invoiceNumber.replace(/[\/]/g, "-")}.pdf"`,
    },
  });
}
