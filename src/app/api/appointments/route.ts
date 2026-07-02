import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { rateLimit, getClientIP, sanitizeText, RATE_LIMIT_ERROR, GENERIC_ERROR } from "@/lib/security";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * POST /api/appointments
 *
 * Creates a new appointment.
 * Can be called by the commercial agent flow (no session required, uses workflow_id) or by admin.
 *
 * Body:
 *   client_id?: string
 *   workflow_id?: string
 *   customer_name: string
 *   customer_phone?: string
 *   customer_email?: string
 *   service_name?: string
 *   appointment_date: string
 *   appointment_time: string
 *   notes?: string
 */
export async function POST(req: Request) {
  const ip = getClientIP(req);
  if (!rateLimit(`appointments:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: RATE_LIMIT_ERROR }, { status: 429 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const {
      client_id,
      workflow_id,
      customer_name,
      customer_phone,
      customer_email,
      service_name,
      appointment_date,
      appointment_time,
      notes,
    } = body;

    if (!customer_name || !appointment_date || !appointment_time) {
      return NextResponse.json({
        error: "customer_name, appointment_date y appointment_time son obligatorios.",
      }, { status: 400 });
    }

    const appointment = await db.appointment.create({
      data: {
        clientId: client_id || null,
        workflowId: workflow_id || null,
        customerName: sanitizeText(customer_name).slice(0, 200),
        customerPhone: customer_phone ? sanitizeText(customer_phone).slice(0, 30) : null,
        customerEmail: customer_email ? sanitizeText(customer_email).slice(0, 254) : null,
        serviceName: service_name ? sanitizeText(service_name).slice(0, 200) : null,
        appointmentDate: sanitizeText(appointment_date).slice(0, 50),
        appointmentTime: sanitizeText(appointment_time).slice(0, 20),
        notes: notes ? sanitizeText(notes).slice(0, 1000) : null,
        status: "pending",
      },
    });

    void logAudit({
      action: "appointment_created",
      entityType: "appointment",
      entityId: appointment.id,
      ipAddress: ip,
      metadata: {
        customer_name: sanitizeText(customer_name).slice(0, 50),
        appointment_date,
        appointment_time,
        service_name: service_name || null,
        client_id: client_id || null,
        workflow_id: workflow_id || null,
      },
    });

    return NextResponse.json({
      ok: true,
      appointment_id: appointment.id,
      status: appointment.status,
      message: `Cita registrada para ${appointment_date} a las ${appointment_time}.`,
    });
  } catch (err) {
    console.error("[appointments POST] error:", err);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}

/**
 * GET /api/appointments
 *
 * Lists appointments (admin-only).
 * Query params: status, limit, offset
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") || 50), 200);
  const offset = Number(searchParams.get("offset") || 0);
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const [appointments, total] = await Promise.all([
    db.appointment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    db.appointment.count({ where }),
  ]);

  return NextResponse.json({ appointments, total, limit, offset });
}
