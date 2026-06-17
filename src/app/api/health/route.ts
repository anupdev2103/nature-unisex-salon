import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Liveness probe — verifies the DB connection. */
export async function GET() {
  try {
    await prisma.$queryRaw`select 1`;
    return NextResponse.json({ status: "ok", time: new Date().toISOString() });
  } catch {
    return NextResponse.json({ status: "degraded", db: false }, { status: 503 });
  }
}
