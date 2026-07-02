// Agenda inteligente para PayFlow SMT.
// Permite al Agente Comercial IA consultar servicios, disponibilidad y crear citas.

import { db } from "./db";

export interface ServiceResult {
  found: boolean;
  service_id: string | null;
  service_name: string | null;
  duration_minutes: number;
  price: number;
}

export interface SlotProposal {
  date: string;
  time: string;
  available: boolean;
}

export interface AvailabilityResult {
  available: boolean;
  slots: SlotProposal[];
  service_name: string | null;
  duration_minutes: number;
}

// Search for a service by name.
export async function searchService(query: string, clientId?: string): Promise<ServiceResult> {
  if (!query || query.trim().length < 2) {
    return { found: false, service_id: null, service_name: null, duration_minutes: 0, price: 0 };
  }

  const where: Record<string, unknown> = { active: true };
  if (clientId) where.clientId = clientId;

  const services = await db.service.findMany({
    where,
    take: 50,
    select: { id: true, name: true, durationMinutes: true, price: true },
  });

  if (services.length === 0) {
    return { found: false, service_id: null, service_name: null, duration_minutes: 0, price: 0 };
  }

  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2);

  const scored = services.map((s) => {
    const nameLower = s.name.toLowerCase();
    let score = 0;
    for (const word of queryWords) {
      if (nameLower.includes(word)) score += 3;
    }
    // Also match if the full query is contained
    if (nameLower.includes(queryLower)) score += 5;
    return { service: s, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored.find((s) => s.score > 0) || scored[0];

  if (!best) {
    return { found: false, service_id: null, service_name: null, duration_minutes: 0, price: 0 };
  }

  return {
    found: true,
    service_id: best.service.id,
    service_name: best.service.name,
    duration_minutes: best.service.durationMinutes,
    price: best.service.price,
  };
}

// Check availability for a given date and propose up to 3 slots.
export async function checkAvailability(
  dateStr: string,
  serviceId: string | null,
  clientId?: string
): Promise<AvailabilityResult> {
  // Parse date (format: "2026-01-15" or "mañana" or "hoy")
  const date = parseDate(dateStr);
  if (!date) {
    return { available: false, slots: [], service_name: null, duration_minutes: 30 };
  }

  const dayOfWeek = date.getDay(); // 0=Sunday

  // Get service duration
  let durationMinutes = 30;
  let serviceName: string | null = null;
  if (serviceId) {
    const service = await db.service.findUnique({
      where: { id: serviceId },
      select: { name: true, durationMinutes: true },
    });
    if (service) {
      durationMinutes = service.durationMinutes;
      serviceName = service.name;
    }
  }

  // Get availability rules for this day
  const whereRule: Record<string, unknown> = { dayOfWeek, active: true };
  if (clientId) whereRule.clientId = clientId;
  const rules = await db.availabilityRule.findMany({ where: whereRule });

  if (rules.length === 0) {
    // No availability rules — default to 9-18h
    rules.push({
      id: "default",
      clientId: clientId || null,
      dayOfWeek,
      startTime: "09:00",
      endTime: "18:00",
      slotDuration: durationMinutes,
      active: true,
      createdAt: new Date(),
    } as any);
  }

  // Get blocked slots for this date
  const whereBlocked: Record<string, unknown> = { date: formatDate(date) };
  if (clientId) whereBlocked.clientId = clientId;
  const blocked = await db.blockedSlot.findMany({ where: whereBlocked });

  // Get existing appointments for this date
  const whereAppt: Record<string, unknown> = { appointmentDate: formatDate(date), status: "confirmed" };
  if (clientId) whereAppt.clientId = clientId;
  const existingAppts = await db.appointment.findMany({ where: whereAppt });

  // Generate slots from rules
  const allSlots: SlotProposal[] = [];
  for (const rule of rules) {
    const slots = generateSlots(rule.startTime, rule.endTime, rule.slotDuration || durationMinutes, formatDate(date));
    for (const slot of slots) {
      const isBlocked = blocked.some((b) => {
        return timeInRange(slot.time, b.startTime, b.endTime);
      });
      const hasAppt = existingAppts.some((a) => {
        return a.appointmentTime === slot.time;
      });
      allSlots.push({
        date: slot.date,
        time: slot.time,
        available: !isBlocked && !hasAppt,
      });
    }
  }

  // Take first 3 available slots
  const availableSlots = allSlots.filter((s) => s.available).slice(0, 3);

  return {
    available: availableSlots.length > 0,
    slots: availableSlots,
    service_name: serviceName,
    duration_minutes: durationMinutes,
  };
}

// Create an appointment.
export async function createAppointment(input: {
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  serviceName?: string;
  appointmentDate: string;
  appointmentTime: string;
  clientId?: string;
  workflowId?: string;
  notes?: string;
}): Promise<{ appointment_id: string; appointment_status: string }> {
  const appointment = await db.appointment.create({
    data: {
      clientId: input.clientId || null,
      workflowId: input.workflowId || null,
      customerName: input.customerName,
      customerPhone: input.customerPhone || null,
      customerEmail: input.customerEmail || null,
      serviceName: input.serviceName || null,
      appointmentDate: input.appointmentDate,
      appointmentTime: input.appointmentTime,
      status: "confirmed",
      notes: input.notes || null,
    },
  });

  return {
    appointment_id: appointment.id,
    appointment_status: appointment.status,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────

function parseDate(dateStr: string): Date | null {
  const lower = dateStr.toLowerCase().trim();
  if (lower === "hoy" || lower === "today") return new Date();
  if (lower === "mañana" || lower === "tomorrow") {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  }
  // Try ISO format
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  return null;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function generateSlots(startTime: string, endTime: string, durationMin: number, date: string): Array<{ date: string; time: string }> {
  const slots: Array<{ date: string; time: string }> = [];
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  let current = startH * 60 + startM;
  const end = endH * 60 + endM;

  while (current + durationMin <= end) {
    const h = Math.floor(current / 60);
    const m = current % 60;
    slots.push({
      date,
      time: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
    });
    current += durationMin;
  }

  return slots;
}

function timeInRange(time: string, start: string, end: string): boolean {
  const [t, s, e] = [time, start, end].map((x) => {
    const [h, m] = x.split(":").map(Number);
    return h * 60 + m;
  });
  return t >= s && t < e;
}
