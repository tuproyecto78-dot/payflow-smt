"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ScrollText,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Eye,
  ShieldCheck,
  User,
  Server,
  Cpu,
  Clock,
  Search,
  X,
} from "lucide-react";
import { formatDateTime } from "@/lib/i18n/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Types (match the API contract) ─────────────────────────────────────────

interface AuditLog {
  id: string;
  userId: string | null;
  actorRole: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  clientId: string | null;
  workflowId: string | null;
  workflowRunId: string | null;
  paymentTransactionId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestMethod: string | null;
  requestPath: string | null;
  status: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  userAgentSummary: string | null;
}

interface PaymentAuditLog {
  id: string;
  paymentTransactionId: string | null;
  provider: string | null;
  providerPaymentId: string | null;
  orderId: string | null;
  previousStatus: string | null;
  newStatus: string | null;
  eventType: string | null;
  source: string;
  rawEvent: unknown;
  processed: boolean;
  idempotencyKey: string | null;
  createdAt: string;
}

// ─── Action metadata ─────────────────────────────────────────────────────────

type ActionCategory =
  | "auth"
  | "subscription"
  | "payment"
  | "whatsapp"
  | "ai"
  | "security"
  | "workflow"
  | "provider";

const ACTION_META: Record<string, { label: string; category: ActionCategory }> = {
  // Auth
  login: { label: "Inicio de sesión", category: "auth" },
  logout: { label: "Cierre de sesión", category: "auth" },
  password_changed: { label: "Contraseña cambiada", category: "auth" },
  // Subscriptions
  subscription_request_created: { label: "Solicitud creada", category: "subscription" },
  subscription_request_updated: { label: "Solicitud actualizada", category: "subscription" },
  subscription_request_approved: { label: "Solicitud aprobada", category: "subscription" },
  subscription_request_rejected: { label: "Solicitud rechazada", category: "subscription" },
  subscription_request_reviewed: { label: "Solicitud revisada", category: "subscription" },
  subscription_missing_info_requested: { label: "Info faltante solicitada", category: "subscription" },
  // Payment channel
  payment_channel_activated: { label: "Canal de pago activado", category: "payment" },
  payment_channel_status_changed: { label: "Estado del canal cambiado", category: "payment" },
  payment_provider_changed: { label: "Proveedor de pago cambiado", category: "payment" },
  // Workflows
  workflow_created: { label: "Flujo creado", category: "workflow" },
  workflow_updated: { label: "Flujo actualizado", category: "workflow" },
  workflow_executed: { label: "Flujo ejecutado", category: "workflow" },
  workflow_opened: { label: "Flujo abierto", category: "workflow" },
  suggested_workflow_created: { label: "Flujo sugerido creado", category: "workflow" },
  // Payments
  payment_created: { label: "Pago creado", category: "payment" },
  payment_status_updated: { label: "Estado de pago actualizado", category: "payment" },
  payment_status_changed: { label: "Estado de pago cambiado", category: "payment" },
  payment_webhook_received: { label: "Webhook recibido", category: "payment" },
  payment_webhook_signature_failed: { label: "Firma de webhook fallida", category: "payment" },
  payment_status_checked: { label: "Estado de pago consultado", category: "payment" },
  // WhatsApp
  whatsapp_message_received: { label: "WhatsApp recibido", category: "whatsapp" },
  whatsapp_message_sent: { label: "WhatsApp enviado", category: "whatsapp" },
  // AI
  ai_agent_executed: { label: "Agente IA ejecutado", category: "ai" },
  // Providers
  provider_connection_tested: { label: "Conexión probada", category: "provider" },
  // Security
  security_error: { label: "Error de seguridad", category: "security" },
  validation_error: { label: "Error de validación", category: "security" },
  unauthorized_access_attempt: { label: "Acceso no autorizado", category: "security" },
};

const CATEGORY_BADGE: Record<ActionCategory, string> = {
  auth: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  subscription: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  payment: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  whatsapp: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
  ai: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400",
  security: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  workflow: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400",
  provider: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400",
};

const STATUS_BADGE: Record<string, string> = {
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  error: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  denied: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "success", label: "Éxito" },
  { value: "error", label: "Error" },
  { value: "denied", label: "Denegado" },
];

const PAGE_SIZE = 25;

// Sentinel value for the "Todas" option in the Select (Radix doesn't allow empty string values).
const ALL_SENTINEL = "__all";

// Inline UA summarizer to avoid bundling the server-side `@/lib/audit` module
// (which imports Prisma). Mirrors `summarizeUserAgent` from the audit lib.
function summarizeUserAgent(ua: string | null | undefined): string {
  if (!ua || typeof ua !== "string") return "";
  let os = "Unknown";
  if (/windows nt 10/i.test(ua)) os = "Windows";
  else if (/mac os x/i.test(ua)) os = "macOS";
  else if (/linux/i.test(ua)) os = "Linux";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad/i.test(ua)) os = "iOS";
  let browser = "Unknown";
  if (/edg/i.test(ua)) browser = "Edge";
  else if (/chrome/i.test(ua)) browser = "Chrome";
  else if (/firefox/i.test(ua)) browser = "Firefox";
  else if (/safari/i.test(ua)) browser = "Safari";
  return `${os} / ${browser}`;
}

function getActionMeta(action: string): { label: string; category: ActionCategory } {
  return ACTION_META[action] || { label: action, category: "auth" };
}

// ─── Detail dialog helpers ───────────────────────────────────────────────────

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        {icon}
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  small,
}: {
  label: string;
  value: string;
  mono?: boolean;
  small?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 py-1 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground w-36 shrink-0 pt-0.5">{label}</span>
      <span
        className={cn(
          "flex-1 break-all",
          mono && "font-mono",
          small ? "text-xs" : "text-sm"
        )}
      >
        {value || "—"}
      </span>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function AuditView() {
  const [filters, setFilters] = useState({
    action: "",
    status: "",
    startDate: "",
    endDate: "",
  });
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [paymentAuditLogs, setPaymentAuditLogs] = useState<PaymentAuditLog[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(offset));
      if (filters.action) params.set("action", filters.action);
      if (filters.status) params.set("status", filters.status);
      if (filters.startDate) {
        const d = new Date(filters.startDate + "T00:00:00");
        if (!isNaN(d.getTime())) params.set("startDate", d.toISOString());
      }
      if (filters.endDate) {
        const d = new Date(filters.endDate + "T23:59:59");
        if (!isNaN(d.getTime())) params.set("endDate", d.toISOString());
      }
      const res = await fetch(`/api/audit-logs?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        toast.error("Error al cargar auditoría");
        return;
      }
      const data = (await res.json()) as {
        logs: AuditLog[];
        total: number;
        limit: number;
        offset: number;
      };
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch {
      toast.error("Error de red");
    } finally {
      setLoading(false);
    }
  }, [filters, offset]);

  useEffect(() => {
    load();
  }, [load]);

  // Client-side search filter applied to the loaded batch.
  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((l) => {
      return (
        (l.entityId && l.entityId.toLowerCase().includes(q)) ||
        (l.clientId && l.clientId.toLowerCase().includes(q)) ||
        (l.workflowId && l.workflowId.toLowerCase().includes(q)) ||
        (l.ipAddress && l.ipAddress.toLowerCase().includes(q))
      );
    });
  }, [logs, search]);

  function updateFilter<K extends keyof typeof filters>(key: K, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
    setOffset(0);
  }

  function resetFilters() {
    setFilters({ action: "", status: "", startDate: "", endDate: "" });
    setSearch("");
    setOffset(0);
  }

  const openDetail = useCallback(async (log: AuditLog) => {
    setSelected(log);
    setPaymentAuditLogs([]);
    if (!log.paymentTransactionId) return;
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/audit-logs/${log.id}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        log: AuditLog;
        paymentAuditLogs: PaymentAuditLog[];
      };
      setPaymentAuditLogs(data.paymentAuditLogs || []);
      if (data.log) setSelected(data.log);
    } catch {
      // ignore — keep current selection
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const hasActiveFilters =
    filters.action !== "" ||
    filters.status !== "" ||
    filters.startDate !== "" ||
    filters.endDate !== "" ||
    search !== "";

  const showingFrom = total === 0 ? 0 : offset + 1;
  const showingTo = offset + filteredLogs.length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Sticky header (title + filters) */}
      <div className="border-b border-border shrink-0">
        <div className="p-5 pb-3">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ScrollText className="size-5 text-primary" />
            Auditoría
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Trazabilidad completa de acciones administrativas, pagos, webhooks, IA y WhatsApp.
          </p>
        </div>

        <div className="px-5 pb-4 flex flex-wrap gap-3 items-end">
          {/* Acción */}
          <div className="flex flex-col gap-1.5 min-w-[180px]">
            <Label className="text-xs">Acción</Label>
            <Select
              value={filters.action || ALL_SENTINEL}
              onValueChange={(v) => updateFilter("action", v === ALL_SENTINEL ? "" : v)}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_SENTINEL}>Todas</SelectItem>
                {Object.entries(ACTION_META).map(([value, meta]) => (
                  <SelectItem key={value} value={value}>
                    {meta.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Estado */}
          <div className="flex flex-col gap-1.5 min-w-[140px]">
            <Label className="text-xs">Estado</Label>
            <Select
              value={filters.status || ALL_SENTINEL}
              onValueChange={(v) => updateFilter("status", v === ALL_SENTINEL ? "" : v)}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_SENTINEL}>Todas</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fecha desde */}
          <div className="flex flex-col gap-1.5 min-w-[150px]">
            <Label className="text-xs">Fecha desde</Label>
            <Input
              type="date"
              className="h-9"
              value={filters.startDate}
              onChange={(e) => updateFilter("startDate", e.target.value)}
            />
          </div>

          {/* Fecha hasta */}
          <div className="flex flex-col gap-1.5 min-w-[150px]">
            <Label className="text-xs">Fecha hasta</Label>
            <Input
              type="date"
              className="h-9"
              value={filters.endDate}
              onChange={(e) => updateFilter("endDate", e.target.value)}
            />
          </div>

          {/* Buscar */}
          <div className="flex flex-col gap-1.5 min-w-[200px] flex-1">
            <Label className="text-xs">Buscar (entidad, cliente, flujo, IP)</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                className="h-9 pl-8"
                placeholder="Filtrar lote cargado…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          </div>

          {/* Limpiar */}
          <Button
            variant="outline"
            size="sm"
            onClick={resetFilters}
            disabled={!hasActiveFilters}
            className="h-9"
          >
            <X className="size-4 mr-1" />
            Limpiar
          </Button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto pf-scroll">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="size-5 animate-spin mr-2" />
            Cargando auditoría…
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-6 max-w-5xl mx-auto">
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center text-center py-16">
                <ScrollText className="size-10 mb-3 opacity-40 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">
                  {hasActiveFilters
                    ? "No hay registros que coincidan con los filtros."
                    : "No hay registros de auditoría."}
                </p>
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={resetFilters}
                  >
                    Limpiar filtros
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="p-4 space-y-4 max-w-7xl mx-auto">
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="min-w-[140px]">Fecha</TableHead>
                    <TableHead className="min-w-[180px]">Acción</TableHead>
                    <TableHead className="min-w-[160px]">Usuario</TableHead>
                    <TableHead className="min-w-[180px]">Entidad</TableHead>
                    <TableHead className="min-w-[100px]">Estado</TableHead>
                    <TableHead className="min-w-[130px]">IP</TableHead>
                    <TableHead className="min-w-[140px]">Navegador</TableHead>
                    <TableHead className="min-w-[90px] text-right">Detalle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => {
                    const meta = getActionMeta(log.action);
                    const statusCls = STATUS_BADGE[log.status || ""] || "bg-muted text-muted-foreground";
                    return (
                      <TableRow key={log.id} className="hover:bg-muted/30">
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDateTime(log.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("whitespace-nowrap", CATEGORY_BADGE[meta.category])}>
                            {meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs">
                              {log.userId ? `${log.userId.slice(0, 8)}…` : "system"}
                            </span>
                            {log.actorRole && (
                              <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                                {log.actorRole}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {log.entityType
                            ? `${log.entityType}:${log.entityId?.slice(0, 8) || "—"}`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("whitespace-nowrap", statusCls)}>
                            {log.status || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {log.ipAddress || "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {log.userAgentSummary || summarizeUserAgent(log.userAgent) || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2"
                            onClick={() => openDetail(log)}
                          >
                            <Eye className="size-3.5 mr-1" />
                            Ver
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Security note */}
            <p
              className={cn(
                "text-xs text-muted-foreground text-center",
                "rounded-lg border border-border bg-muted/30 px-4 py-3"
              )}
            >
              <ShieldCheck className="size-3.5 inline mr-1 align-text-bottom" />
              Los tokens, API keys y credenciales nunca se guardan en logs. Los
              teléfonos y cédulas se muestran parcialmente.
            </p>
          </div>
        )}
      </div>

      {/* Sticky footer (pagination) */}
      <div className="border-t border-border shrink-0 px-4 py-2.5 flex items-center justify-between gap-2 text-sm bg-background">
        <div className="text-xs text-muted-foreground">
          {total === 0
            ? "Sin registros"
            : `Mostrando ${showingFrom}-${showingTo} de ${total}`}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0 || loading}
          >
            <ChevronLeft className="size-4" />
            Anterior
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => setOffset(offset + PAGE_SIZE)}
            disabled={offset + PAGE_SIZE >= total || loading}
          >
            Siguiente
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto pf-scroll">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ScrollText className="size-5 text-primary" />
                  Detalle de auditoría
                </DialogTitle>
                <DialogDescription>
                  Registro individual del evento seleccionado.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Banner */}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={CATEGORY_BADGE[getActionMeta(selected.action).category]}>
                    {getActionMeta(selected.action).label}
                  </Badge>
                  <Badge className={STATUS_BADGE[selected.status || ""] || "bg-muted text-muted-foreground"}>
                    {selected.status || "—"}
                  </Badge>
                  {(selected.requestMethod || selected.requestPath) && (
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {selected.requestMethod || "?"} {selected.requestPath || ""}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {formatDateTime(selected.createdAt)}
                  </span>
                </div>

                {/* Actor */}
                <Section title="Actor" icon={<User className="size-3.5" />}>
                  <Field label="Usuario ID" value={selected.userId || "system"} mono />
                  <Field label="Rol" value={selected.actorRole || "—"} />
                  <Field label="IP" value={selected.ipAddress || "—"} mono />
                  <Field
                    label="Resumen UA"
                    value={
                      selected.userAgentSummary ||
                      summarizeUserAgent(selected.userAgent) ||
                      "—"
                    }
                  />
                  <Field label="User-Agent" value={selected.userAgent || "—"} mono small />
                </Section>

                {/* Entidades */}
                <Section title="Entidades" icon={<Server className="size-3.5" />}>
                  <Field label="Tipo" value={selected.entityType || "—"} />
                  <Field label="ID" value={selected.entityId || "—"} mono />
                  <Field label="Cliente ID" value={selected.clientId || "—"} mono />
                  <Field label="Workflow ID" value={selected.workflowId || "—"} mono />
                  <Field label="Workflow Run ID" value={selected.workflowRunId || "—"} mono />
                  <Field label="Payment Tx ID" value={selected.paymentTransactionId || "—"} mono />
                </Section>

                {/* Metadata segura */}
                <Section title="Metadata segura" icon={<Cpu className="size-3.5" />}>
                  <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto pf-scroll whitespace-pre-wrap break-all font-mono max-h-64">
                    {JSON.stringify(selected.metadata ?? {}, null, 2)}
                  </pre>
                </Section>

                {/* Payment audit logs timeline */}
                {selected.paymentTransactionId && (
                  <Section title="Línea de tiempo del pago" icon={<Clock className="size-3.5" />}>
                    {loadingDetail ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />
                        Cargando historial…
                      </div>
                    ) : paymentAuditLogs.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No hay eventos de pago registrados para esta transacción.
                      </p>
                    ) : (
                      <ol className="space-y-2">
                        {paymentAuditLogs.map((p) => (
                          <li
                            key={p.id}
                            className="border-l-2 border-primary/40 pl-3 py-1"
                          >
                            <div className="flex items-center gap-2 text-xs flex-wrap">
                              <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                                {p.source}
                              </Badge>
                              <span className="font-mono">
                                {p.previousStatus || "—"} → {p.newStatus || "—"}
                              </span>
                              <span className="text-muted-foreground ml-auto">
                                {formatDateTime(p.createdAt)}
                              </span>
                            </div>
                            {(p.eventType || p.provider) && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {p.eventType && <span>Evento: {p.eventType}</span>}
                                {p.eventType && p.provider && <span> · </span>}
                                {p.provider && <span>Proveedor: {p.provider}</span>}
                              </div>
                            )}
                          </li>
                        ))}
                      </ol>
                    )}
                  </Section>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)}>
                  Cerrar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
