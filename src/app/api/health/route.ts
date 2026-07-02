import { NextResponse } from "next/server";

/**
 * GET /api/health
 *
 * Simple health-check endpoint. Does NOT query PayPhone, Supabase, or any
 * external service. Used to verify the dev server is alive.
 *
 * Response: { ok: true, app: "PayFlow SMT" }
 */
export async function GET() {
  return NextResponse.json(
    { ok: true, app: "PayFlow SMT" },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
