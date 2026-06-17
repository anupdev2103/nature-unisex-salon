import { z } from "zod";

// Reusable primitives
const phone = z
  .string()
  .trim()
  .regex(/^[0-9]{10}$/, "Enter a 10-digit phone number");

const rupees = z.coerce
  .number()
  .nonnegative("Must be zero or more")
  .finite();

// ───────────────────────── Branch ─────────────────────────
export const branchSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,8}$/, "2–8 letters/numbers"),
  address: z.string().trim().optional().or(z.literal("")),
  phone: z.string().trim().optional().or(z.literal("")),
  isActive: z.coerce.boolean().default(true),
});

// ───────────────────────── Customer ─────────────────────────
export const customerSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  phone,
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  dob: z.string().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
  registeredBranchId: z.string().uuid("Select a branch"),
  status: z.enum(["ACTIVE", "INACTIVE", "BLOCKED"]).default("ACTIVE"),
});

// Quick-add inside Billing — only Name + Mobile required.
export const quickCustomerSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  phone,
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  dob: z.string().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
  registeredBranchId: z.string().uuid("Select a branch"),
});

// ───────────────────────── Service ─────────────────────────
export const serviceSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  categoryId: z.string().uuid().optional().or(z.literal("")),
  price: rupees,
  durationMin: z.coerce.number().int().positive().default(30),
  isActive: z.coerce.boolean().default(true),
});

export const serviceCategorySchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  sortOrder: z.coerce.number().int().default(0),
});

// ───────────────────────── Membership plan ─────────────────────────
export const membershipPlanSchema = z
  .object({
    name: z.string().trim().min(2, "Name is required"),
    kind: z.enum(["WALLET", "UNLIMITED"]),
    validityDays: z.coerce.number().int().positive("Validity required"),
    // wallet
    price: rupees.optional(),
    walletValue: rupees.optional(),
    // unlimited
    flatPrice: rupees.optional(),
    benefitLabel: z.string().trim().optional().or(z.literal("")),
    isActive: z.coerce.boolean().default(true),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "WALLET") {
      if (v.price == null || v.price <= 0)
        ctx.addIssue({ code: "custom", path: ["price"], message: "Required" });
      if (v.walletValue == null || v.walletValue <= 0)
        ctx.addIssue({ code: "custom", path: ["walletValue"], message: "Required" });
      if (v.price != null && v.walletValue != null && v.walletValue < v.price)
        ctx.addIssue({
          code: "custom",
          path: ["walletValue"],
          message: "Wallet value should be ≥ price",
        });
    } else {
      if (v.flatPrice == null || v.flatPrice <= 0)
        ctx.addIssue({ code: "custom", path: ["flatPrice"], message: "Required" });
      if (!v.benefitLabel)
        ctx.addIssue({ code: "custom", path: ["benefitLabel"], message: "Required" });
    }
  });

export const sellMembershipSchema = z.object({
  customerId: z.string().uuid(),
  planId: z.string().uuid(),
  branchId: z.string().uuid(),
  paymentMethod: z.enum(["CASH", "UPI", "CARD", "BANK_TRANSFER"]),
});

// ───────────────────────── Coupon ─────────────────────────
export const couponSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(3, "Min 3 chars")
    .regex(/^[A-Z0-9_-]+$/, "Letters, numbers, - and _ only"),
  amount: rupees.refine((v) => v > 0, "Must be greater than zero"),
  expiryDate: z.string().optional().or(z.literal("")),
  usageLimit: z.coerce.number().int().positive().optional(),
  minBillAmount: rupees.default(0),
  status: z.enum(["ACTIVE", "DISABLED"]).default("ACTIVE"),
});

// ───────────────────────── Billing ─────────────────────────
export const billItemSchema = z.object({
  serviceId: z.string().uuid(),
  quantity: z.coerce.number().int().positive().default(1),
  // staff may override price per-line (e.g. negotiated). In rupees.
  unitPrice: rupees.optional(),
  lineDiscount: rupees.default(0),
  membershipBenefit: z.coerce.boolean().default(false),
});

export const createInvoiceSchema = z.object({
  branchId: z.string().uuid(),
  customerId: z.string().uuid(),
  items: z.array(billItemSchema).min(1, "Add at least one service"),
  billDiscount: rupees.default(0),
  billDiscountReason: z.string().trim().optional().or(z.literal("")),
  couponCode: z.string().trim().optional().or(z.literal("")),
  membershipId: z.string().uuid().optional().or(z.literal("")),
  useWallet: z.coerce.boolean().default(false),
  paymentMethod: z.enum(["CASH", "UPI", "CARD", "BANK_TRANSFER"]),
  paymentReference: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
});

// ───────────────────────── Settings ─────────────────────────
export const settingsSchema = z.object({
  salonName: z.string().trim().min(2),
  gstNumber: z.string().trim().optional().or(z.literal("")),
  invoicePrefix: z.string().trim().min(1).max(10),
  address: z.string().trim().optional().or(z.literal("")),
  whatsappNumber: z.string().trim().optional().or(z.literal("")),
  email: z.string().trim().email().optional().or(z.literal("")),
  taxRatePct: z.coerce.number().min(0).max(100).default(0),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type CustomerInput = z.infer<typeof customerSchema>;
export type ServiceInput = z.infer<typeof serviceSchema>;
export type MembershipPlanInput = z.infer<typeof membershipPlanSchema>;
