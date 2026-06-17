import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatINR } from "@/lib/money";

export interface InvoicePdfData {
  invoiceNumber: string;
  createdAt: Date;
  salonName: string;
  gstNumber?: string | null;
  address?: string | null;
  phone?: string | null;
  branchName: string;
  customerName: string;
  customerPhone: string;
  staffName: string;
  items: { name: string; qty: number; unitPrice: number; lineTotal: number; benefit: boolean }[];
  subtotal: number;
  itemDiscountTotal: number;
  billDiscountTotal: number;
  couponTotal: number;
  membershipApplied: number;
  taxAmount: number;
  taxRatePctBps: number;
  grandTotal: number;
  paymentMethod: string;
}

/** Render an A4 invoice PDF and return the raw bytes. */
export async function buildInvoicePdf(d: InvoicePdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  const margin = 48;
  let y = height - margin;
  const green = rgb(0.06, 0.5, 0.25);
  const grey = rgb(0.4, 0.4, 0.4);

  const text = (s: string, x: number, yy: number, size = 10, f = font, color = rgb(0, 0, 0)) =>
    page.drawText(s, { x, y: yy, size, font: f, color });
  const right = (s: string, xRight: number, yy: number, size = 10, f = font) =>
    page.drawText(s, { x: xRight - f.widthOfTextAtSize(s, size), y: yy, size, font: f });

  // Header
  text(d.salonName, margin, y, 20, bold, green);
  y -= 18;
  if (d.address) { text(d.address, margin, y, 9, font, grey); y -= 12; }
  const contactBits = [d.phone ? `Ph: ${d.phone}` : null, d.gstNumber ? `GSTIN: ${d.gstNumber}` : null].filter(Boolean).join("   ");
  if (contactBits) { text(contactBits, margin, y, 9, font, grey); y -= 12; }

  right("TAX INVOICE", width - margin, height - margin, 14, bold);
  right(d.invoiceNumber, width - margin, height - margin - 18, 10, bold);
  right(d.createdAt.toLocaleString("en-IN"), width - margin, height - margin - 32, 9, font);

  y -= 16;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: green });
  y -= 22;

  // Bill to + branch
  text("Bill To", margin, y, 9, bold, grey);
  text("Branch", width / 2, y, 9, bold, grey);
  y -= 14;
  text(d.customerName, margin, y, 11, bold);
  text(d.branchName, width / 2, y, 11, bold);
  y -= 13;
  text(d.customerPhone, margin, y, 9, font, grey);
  text(`Served by: ${d.staffName}`, width / 2, y, 9, font, grey);
  y -= 24;

  // Table header
  const colQty = width - margin - 210;
  const colRate = width - margin - 130;
  const colAmt = width - margin;
  page.drawRectangle({ x: margin, y: y - 4, width: width - margin * 2, height: 20, color: rgb(0.95, 0.97, 0.95) });
  text("Service", margin + 6, y, 9, bold);
  text("Qty", colQty, y, 9, bold);
  text("Rate", colRate, y, 9, bold);
  right("Amount", colAmt - 6, y, 9, bold);
  y -= 22;

  for (const it of d.items) {
    text(it.name, margin + 6, y, 10);
    text(String(it.qty), colQty, y, 10);
    text(formatINR(it.unitPrice), colRate, y, 10);
    right(it.benefit ? "Membership" : formatINR(it.lineTotal), colAmt - 6, y, 10);
    y -= 18;
    if (y < 160) { y = height - margin; pdf.addPage(); }
  }

  y -= 6;
  page.drawLine({ start: { x: colRate - 10, y }, end: { x: width - margin, y }, thickness: 0.5, color: grey });
  y -= 18;

  const totalRow = (label: string, value: string, f = font) => {
    text(label, colRate - 10, y, 10, f);
    right(value, colAmt - 6, y, 10, f);
    y -= 16;
  };
  totalRow("Subtotal", formatINR(d.subtotal));
  if (d.itemDiscountTotal) totalRow("Item discount", `- ${formatINR(d.itemDiscountTotal)}`);
  if (d.billDiscountTotal) totalRow("Bill discount", `- ${formatINR(d.billDiscountTotal)}`);
  if (d.couponTotal) totalRow("Coupon", `- ${formatINR(d.couponTotal)}`);
  if (d.membershipApplied) totalRow("Wallet paid", `- ${formatINR(d.membershipApplied)}`);
  if (d.taxAmount) totalRow(`GST (${(d.taxRatePctBps / 100).toFixed(0)}%)`, formatINR(d.taxAmount));
  y -= 4;
  page.drawLine({ start: { x: colRate - 10, y: y + 8 }, end: { x: width - margin, y: y + 8 }, thickness: 1, color: green });
  totalRow("TOTAL", formatINR(d.grandTotal), bold);
  y -= 6;
  totalRow("Paid via", d.paymentMethod);

  y -= 24;
  text("Thank you for visiting Nature Unisex Salon!", margin, y, 10, font, green);

  return pdf.save();
}
