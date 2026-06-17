import { z } from "zod";

/** Standard result shape returned by every server action. */
export type FieldErrors = Record<string, string[] | undefined>;

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(
  error: string,
  fieldErrors?: FieldErrors,
): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

/** Parse a Zod schema and return a uniform failure on error. */
export function parse<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
): { success: true; data: z.infer<T> } | { success: false; result: ActionResult<never> } {
  const r = schema.safeParse(data);
  if (r.success) return { success: true, data: r.data };
  return {
    success: false,
    result: fail("Please fix the highlighted fields.", r.error.flatten().fieldErrors),
  };
}

/** Convert a thrown error into a friendly ActionResult. */
export function toActionError(e: unknown): ActionResult<never> {
  const msg = e instanceof Error ? e.message : "Something went wrong";
  if (msg === "UNAUTHORIZED") return fail("You must be signed in.");
  if (msg === "FORBIDDEN") return fail("You do not have permission for this.");
  return fail(msg);
}
