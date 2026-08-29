import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Minimal health check för smoke tests/övervakning. Exponerar aldrig
// hemligheter, schema eller stack traces.
export async function GET() {
  let database = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "unavailable";
  }
  const ok = database === "ok";
  return NextResponse.json(
    { ok, database },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
