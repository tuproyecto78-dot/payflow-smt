import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  getAuditLogById,
  queryPaymentAuditLogs,
  logAuditFromRequest,
  summarizeUserAgent,
} from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/audit-logs/[id]
//
// Admin-only fetch of a single audit log by id.
// If the log has a `paymentTransactionId`, also returns the related
// PaymentAuditLog entries (most recent 100).
//
// Response: { log, paymentAuditLogs }
//   - log.metadata is parsed JSON.
//   - log.userAgentSummary is added for convenience.
//   - paymentAuditLogs is `[]` when the log has no paymentTransactionId
//     or when no payment audit logs exist for that transaction.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    void logAuditFromRequest(req, {
      userId: session?.userId || null,
      actorRole: session?.role === "admin" ? "admin" : "user",
      action: "unauthorized_access_attempt",
      entityType: "audit_log",
      status: "denied",
      metadata: { reason: "non_admin_attempted_audit_logs_detail" },
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: "Id requerido." },
        { status: 400 }
      );
    }

    const log = await getAuditLogById(id);
    if (!log) {
      return NextResponse.json(
        { error: "Registro no encontrado." },
        { status: 404 }
      );
    }

    // Parse metadata JSON.
    let parsedMetadata: unknown = {};
    try {
      parsedMetadata = JSON.parse(log.metadata || "{}");
    } catch {
      parsedMetadata = {};
    }

    const serializedLog = {
      ...log,
      metadata: parsedMetadata,
      userAgentSummary: summarizeUserAgent(log.userAgent),
    };

    // Fetch related payment audit logs if applicable.
    let paymentAuditLogs: Awaited<
      ReturnType<typeof queryPaymentAuditLogs>
    > = [];
    if (log.paymentTransactionId) {
      paymentAuditLogs = await queryPaymentAuditLogs(log.paymentTransactionId);
    }

    return NextResponse.json({
      log: serializedLog,
      paymentAuditLogs,
    });
  } catch (err) {
    console.error("[audit-logs/detail] error", err);
    return NextResponse.json(
      { error: "Error consultando el registro." },
      { status: 500 }
    );
  }
}
