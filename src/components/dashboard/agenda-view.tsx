"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarClock, Plus, Loader2, Power, CalendarPlus, Clock, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Service { id: string; name: string; durationMinutes: number; price: number; active: boolean }
interface AvailabilityRule { id: string; dayOfWeek: number; startTime: string; endTime: string; slotDuration: number; active: boolean }
interface Appointment { id: string; customerName: string | null; customerPhone: string | null; serviceName: string | null; appointmentDate: string | null; appointmentTime: string | null; status: string; notes: string | null; createdAt: string }

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const APPT_STATUS: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  pending: { label: "Pendiente", cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400", icon: Clock },
  confirmed: { label: "Confirmada", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400", icon: CheckCircle2 },
  cancelled: { label: "Cancelada", cls: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400", icon: XCircle },
  completed: { label: "Completada", cls: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-400", icon: CheckCircle2 },
};

export function AgendaView() {
  const [tab, setTab] = useState<"appointments" | "services" | "availability">("appointments");
  const [services, setServices] = useState<Service[]>([]);
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [svcOpen, setSvcOpen] = useState(false);
  const [svcForm, setSvcForm] = useState({ name: "", durationMinutes: 30, price: 0 });
  const [availOpen, setAvailOpen] = useState(false);
  const [availForm, setAvailForm] = useState({ dayOfWeek: 1, startTime: "09:00", endTime: "18:00", slotDuration: 30 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [svcRes, availRes, apptRes] = await Promise.all([
        fetch("/api/services").catch(() => null),
        fetch("/api/availability").catch(() => null),
        fetch("/api/appointments?limit=50").catch(() => null),
      ]);
      if (svcRes && svcRes.ok) { const d = await svcRes.json(); setServices(d.services || []); }
      if (availRes && availRes.ok) { const d = await availRes.json(); setRules(d.rules || []); }
      if (apptRes && apptRes.ok) { const d = await apptRes.json(); setAppointments(d.appointments || []); }
    } catch { toast.error("Error al cargar datos de agenda"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createService() {
    if (!svcForm.name.trim()) { toast.error("El nombre es obligatorio"); return; }
    try {
      const res = await fetch("/api/services", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(svcForm) });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error || "Error"); return; }
      toast.success("Servicio creado"); setSvcOpen(false); setSvcForm({ name: "", durationMinutes: 30, price: 0 }); await load();
    } catch { toast.error("Error de red"); }
  }

  async function toggleService(svc: Service) {
    try {
      const res = await fetch(`/api/services/${svc.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !svc.active }) });
      if (!res.ok) { toast.error("Error"); return; }
      toast.success(svc.active ? "Desactivado" : "Activado"); await load();
    } catch { toast.error("Error de red"); }
  }

  async function createAvailability() {
    try {
      const res = await fetch("/api/availability", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(availForm) });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error || "Error"); return; }
      toast.success("Regla creada"); setAvailOpen(false); await load();
    } catch { toast.error("Error de red"); }
  }

  async function updateAppointmentStatus(appt: Appointment, status: string) {
    try {
      const res = await fetch(`/api/appointments/${appt.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      if (!res.ok) { toast.error("Error"); return; }
      toast.success("Cita actualizada"); await load();
    } catch { toast.error("Error de red"); }
  }

  const confirmedCount = appointments.filter((a) => a.status === "confirmed").length;
  const pendingCount = appointments.filter((a) => a.status === "pending").length;

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="p-5 border-b border-border shrink-0">
        <h1 className="text-xl font-bold flex items-center gap-2"><CalendarClock className="size-5 text-purple-500" />Agenda</h1>
        <p className="text-sm text-muted-foreground mt-1">Gestiona servicios, disponibilidad y citas agendadas por el Agente Comercial IA.</p>
        <div className="grid grid-cols-4 gap-3 mt-4">
          <StatBox label="Citas totales" value={appointments.length} />
          <StatBox label="Confirmadas" value={confirmedCount} color="text-emerald-600" />
          <StatBox label="Pendientes" value={pendingCount} color="text-amber-600" />
          <StatBox label="Servicios" value={services.filter((s) => s.active).length} color="text-purple-600" />
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {[{ v: "appointments", l: "Citas", c: appointments.length }, { v: "services", l: "Servicios", c: services.length }, { v: "availability", l: "Disponibilidad", c: rules.length }].map(({ v, l, c }) => (
            <button key={v} onClick={() => setTab(v as typeof tab)} className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5", tab === v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>{l}<span className={cn("rounded-full px-1.5 py-0.5 text-[9px]", tab === v ? "bg-primary-foreground/20" : "bg-background/60")}>{c}</span></button>
          ))}
        </div>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-3 max-w-4xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="size-5 animate-spin mr-2" />Cargando…</div>
          ) : tab === "appointments" ? (
            appointments.length === 0 ? (
              <Card className="border-dashed"><CardContent className="flex flex-col items-center justify-center text-center py-16"><CalendarClock className="size-10 mb-3 opacity-40 text-muted-foreground" /><p className="text-sm font-medium text-muted-foreground">No hay citas agendadas</p></CardContent></Card>
            ) : (
              appointments.map((appt) => {
                const st = APPT_STATUS[appt.status] || { label: appt.status, cls: "bg-muted", icon: Clock };
                const StIcon = st.icon;
                return (
                  <Card key={appt.id} className="overflow-hidden"><CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0"><div className="flex items-center gap-2 mb-1"><StIcon className="size-4 text-purple-500" /><span className="font-medium text-sm">{appt.customerName || "Cliente"}</span></div>
                      <div className="text-xs text-muted-foreground space-y-0.5"><div>📅 {appt.appointmentDate || "—"} a las {appt.appointmentTime || "—"}</div>{appt.serviceName && <div>🏷️ {appt.serviceName}</div>}{appt.customerPhone && <div>📱 {appt.customerPhone}</div>}</div></div>
                      <div className="flex flex-col items-end gap-1"><Badge className={cn("shrink-0", st.cls)}>{st.label}</Badge>
                        {appt.status === "pending" && (<div className="flex gap-1 mt-1"><Button size="sm" variant="outline" className="h-7 text-[10px] px-2" onClick={() => updateAppointmentStatus(appt, "confirmed")}>Confirmar</Button><Button size="sm" variant="outline" className="h-7 text-[10px] px-2 text-destructive" onClick={() => updateAppointmentStatus(appt, "cancelled")}>Cancelar</Button></div>)}
                        {appt.status === "confirmed" && <Button size="sm" variant="outline" className="h-7 text-[10px] px-2 mt-1" onClick={() => updateAppointmentStatus(appt, "completed")}>Marcar completada</Button>}
                      </div>
                    </div>
                  </CardContent></Card>
                );
              })
            )
          ) : tab === "services" ? (
            <>
              <div className="flex justify-end mb-2"><Button onClick={() => setSvcOpen(true)} className="bg-purple-500 hover:bg-purple-600 text-white" size="sm"><Plus className="size-4 mr-1" />Crear servicio</Button></div>
              {services.length === 0 ? <Card className="border-dashed"><CardContent className="flex flex-col items-center justify-center text-center py-16"><CalendarPlus className="size-10 mb-3 opacity-40 text-muted-foreground" /><p className="text-sm font-medium text-muted-foreground">No hay servicios configurados</p></CardContent></Card> : services.map((svc) => (
                <Card key={svc.id} className={cn("overflow-hidden", !svc.active && "opacity-60")}><CardContent className="p-4"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2 mb-1"><span className="font-medium text-sm">{svc.name}</span><Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 text-[10px]">${svc.price.toFixed(2)}</Badge><Badge variant="outline" className="text-[10px]">{svc.durationMinutes} min</Badge></div></div><div className="flex items-center gap-1 shrink-0"><Badge className={cn("text-[10px]", svc.active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" : "bg-slate-100 text-slate-500")}>{svc.active ? "Activo" : "Inactivo"}</Badge><Button size="sm" variant="ghost" className="size-8 p-0" onClick={() => toggleService(svc)}><Power className="size-3.5" /></Button></div></div></CardContent></Card>
              ))}
            </>
          ) : (
            <>
              <div className="flex justify-end mb-2"><Button onClick={() => setAvailOpen(true)} className="bg-purple-500 hover:bg-purple-600 text-white" size="sm"><Plus className="size-4 mr-1" />Crear regla</Button></div>
              {rules.length === 0 ? <Card className="border-dashed"><CardContent className="flex flex-col items-center justify-center text-center py-16"><Clock className="size-10 mb-3 opacity-40 text-muted-foreground" /><p className="text-sm font-medium text-muted-foreground">No hay reglas de disponibilidad</p><p className="text-xs text-muted-foreground mt-1">El agente usará horario por defecto (Lun-Vie 9-18h).</p></CardContent></Card> : rules.map((rule) => (
                <Card key={rule.id} className={cn("overflow-hidden", !rule.active && "opacity-60")}><CardContent className="p-4"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2 mb-1"><CalendarClock className="size-4 text-purple-500" /><span className="font-medium text-sm">{DAYS[rule.dayOfWeek]}</span></div><div className="text-xs text-muted-foreground">🕐 {rule.startTime} - {rule.endTime} · Slots de {rule.slotDuration} min</div></div><Badge className={cn("text-[10px]", rule.active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" : "bg-slate-100 text-slate-500")}>{rule.active ? "Activo" : "Inactivo"}</Badge></div></CardContent></Card>
              ))}
            </>
          )}
        </div>
      </ScrollArea>
      <Dialog open={svcOpen} onOpenChange={setSvcOpen}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle className="flex items-center gap-2"><CalendarPlus className="size-5 text-purple-500" />Crear servicio</DialogTitle></DialogHeader><div className="space-y-3 py-2"><div className="space-y-1.5"><Label className="text-xs">Nombre *</Label><Input value={svcForm.name} onChange={(e) => setSvcForm({ ...svcForm, name: e.target.value })} placeholder="Consulta médica" className="h-9 text-sm" /></div><div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label className="text-xs">Duración (min)</Label><Input type="number" value={svcForm.durationMinutes} onChange={(e) => setSvcForm({ ...svcForm, durationMinutes: Number(e.target.value) })} className="h-9 text-sm" /></div><div className="space-y-1.5"><Label className="text-xs">Precio (USD)</Label><Input type="number" value={svcForm.price} onChange={(e) => setSvcForm({ ...svcForm, price: Number(e.target.value) })} className="h-9 text-sm" /></div></div></div><DialogFooter><Button variant="outline" onClick={() => setSvcOpen(false)}>Cancelar</Button><Button onClick={createService} className="bg-purple-500 hover:bg-purple-600 text-white">Crear</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={availOpen} onOpenChange={setAvailOpen}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle className="flex items-center gap-2"><Clock className="size-5 text-purple-500" />Crear regla de disponibilidad</DialogTitle></DialogHeader><div className="space-y-3 py-2"><div className="space-y-1.5"><Label className="text-xs">Día</Label><select value={availForm.dayOfWeek} onChange={(e) => setAvailForm({ ...availForm, dayOfWeek: Number(e.target.value) })} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">{DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}</select></div><div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label className="text-xs">Inicio</Label><Input type="time" value={availForm.startTime} onChange={(e) => setAvailForm({ ...availForm, startTime: e.target.value })} className="h-9 text-sm" /></div><div className="space-y-1.5"><Label className="text-xs">Fin</Label><Input type="time" value={availForm.endTime} onChange={(e) => setAvailForm({ ...availForm, endTime: e.target.value })} className="h-9 text-sm" /></div></div><div className="space-y-1.5"><Label className="text-xs">Slot (min)</Label><Input type="number" value={availForm.slotDuration} onChange={(e) => setAvailForm({ ...availForm, slotDuration: Number(e.target.value) })} className="h-9 text-sm" /></div></div><DialogFooter><Button variant="outline" onClick={() => setAvailOpen(false)}>Cancelar</Button><Button onClick={createAvailability} className="bg-purple-500 hover:bg-purple-600 text-white">Crear</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color?: string }) {
  return <div className="rounded-lg border border-border bg-card p-3"><div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div><div className={cn("text-2xl font-bold", color)}>{value}</div></div>;
}
