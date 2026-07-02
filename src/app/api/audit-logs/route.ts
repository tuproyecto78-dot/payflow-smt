import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  queryAuditLogs,
  logAuditFromRequest,
  summarizeUserAgent,
} from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/audit-logs
//
// Admin-only paginated audit log query.
//
// Query params (all optional):
//   limit                     — max 200, default 50
//   offset                    — default 0
//   action                    — exact action match
//   userId                    — exact userId match
//   entityType                — exact entityType match
//   entityId                  — exact entityId match
//   clientId                  — exact clientId match
//   workflowId                — exact workflowId match
//   paymentTransactionId      — exact paymentTransactionId match
//   status                    — "success" | "error" | "denied"
//   startDate                 — ISO 8601 (inclusive)
//   endDate                   — ISO 8601 (inclusive)
//
// Response: { logs, total, limit, offset }
//   Each log has all DB fields including parsed `metadata`.
//   `userAgentSummary` is added for the list view (parsed from `userAgent`).
export async function GET(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    // Log the unauthorized attempt before rejecting.
    void logAuditFromRequest(req, {
      userId: session?.userId || null,
      actorRole: session?.role === "admin" ? "admin" : "user",
      action: "unauthorized_access_attempt",
      entityType: "audit_log",
      status: "denied",
      metadata: { reason: "non_admin_attempted_audit_logs_list" },
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const sp = url.searchParams;

    const rawLimit = Number.parseInt(sp.get("limit") || "", 10);
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(rawLimit, 200)
        : 50;

    const rawOffset = Number.parseInt(sp.get("offset") || "", 10);
    const offset =
      Number.isFinite(rawOffset) && rawOffset > 0 ? rawOffset : 0;

    const action = sp.get("action") || undefined;
    const userId = sp.get("userId") || undefined;
    const entityType = sp.get("entityType") || undefined;
    const entityId = sp.get("entityId") || undefined;
    const clientId = sp.get("clientId") || undefined;
    const workflowId = sp.get("workflowId") || undefined;
    const paymentTransactionId = sp.get("paymentTransactionId") || undefined;
    const status = sp.get("status") || undefined;

    let startDate: Date | undefined;
    let endDate: Date | undefined;
    const rawStart = sp.get("startDate");
    if (rawStart) {
      const d = new Date(rawStart);
      if (!isNaN(d.getTime())) startDate = d;
    }
    const rawEnd = sp.get("endDate");
    if (rawEnd) {
      const d = new Date(rawEnd);
      if (!isNaN(d.getTime())) endDate = d;
    }

    const { logs, total } = await queryAuditLogs({
      limit,
      offset,
      action,
      userId,
      entityType,
      entityId,
      clientId,
      workflowId,
      paymentTransactionId,
      status,
      startDate,
      endDate,
    });

    // Parse JSON metadata + add userAgentSummary for list view.
    const serializedLogs = logs.map((log) => {
      let parsedMetadata: unknown = {};
      try {
        parsedMetadata = JSON.parse(log.metadata || "{}");
      } catch {
        parsedMetadata = {};
      }
      return {
        ...log,
        metadata: parsedMetadata,
        userAgentSummary: summarizeUserAgent(log.userAgent),
      };
    });

    return NextResponse.json({
      logs: serializedLogs,
      total,
      limit,
      offset,
    });
  } catch (err) {
    console.error("[audit-logs/list] error", err);
    return NextResponse.json(
      { error: "Error consultando la bitácora." },
      { status: 500 }
    );
  }
}
