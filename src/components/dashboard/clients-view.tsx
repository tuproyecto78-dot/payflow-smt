"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Users,
  Building2,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  ShieldCheck,
  Search,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ROLES,
  ROLE_LABELS,
  ALL_ROLES,
  ALL_MODULES,
  MODULE_LABELS,
  CLIENT_STATUS,
} from "@/lib/roles";

interface ClientAccountItem {
  id: string;
  businessName: string;
  contactEmail: string;
  plan: string;
  status: string;
  modules: string[];
  createdAt: string;
  memberCount?: number;
}

interface ProfileItem {
  id: string;
  userId: string;
  email: string;
  fullName: string | null;
  role: string;
  status: string;
  clientId: string | null;
  clientAccount?: { businessName: string } | null;
  createdAt: string;
}

const STATUS_BADGE: Record<string, string> = {
  [CLIENT_STATUS.PENDING_REVIEW]:
    "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  [CLIENT_STATUS.ACTIVE]:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  [CLIENT_STATUS.SUSPENDED]:
    "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  [CLIENT_STATUS.CANCELLED]:
    "bg-muted text-muted-foreground",
};

const STATUS_LABEL: Record<string, string> = {
  [CLIENT_STATUS.PENDING_REVIEW]: "Pendiente",
  [CLIENT_STATUS.ACTIVE]: "Activo",
  [CLIENT_STATUS.SUSPENDED]: "Suspendido",
  [CLIENT_STATUS.CANCELLED]: "Cancelado",
};

export function ClientsView() {
  const [clients, setClients] = useState<ClientAccountItem[]>([]);
  const [profiles, setProfiles] = useState<ProfileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editClient, setEditClient] = useState<ClientAccountItem | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignEmail, setAssignEmail] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [clientsRes, profilesRes] = await Promise.all([
        fetch("/api/admin/clients", { cache: "no-store" }),
        fetch("/api/admin/profiles", { cache: "no-store" }),
      ]);
      if (clientsRes.ok) {
        const data = await clientsRes.json();
        setClients(data.clients || []);
      } else {
        toast.error("No tienes acceso a la lista de clientes");
      }
      if (profilesRes.ok) {
        const data = await profilesRes.json();
        setProfiles(data.profiles || []);
      }
    } catch {
      toast.error("Error de red");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function deleteClient(client: ClientAccountItem) {
    if (!confirm(`¿Eliminar el cliente "${client.businessName}"?`)) return;
    const res = await fetch(`/api/admin/clients/${client.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("Cliente eliminado");
      await load();
    } else {
      toast.error("Error al eliminar");
    }
  }

  const filteredProfiles = profiles.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.email.toLowerCase().includes(q) ||
      (p.fullName || "").toLowerCase().includes(q) ||
      p.role.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 overflow-y-auto pf-scroll">
      <div className="max-w-6xl mx-auto p-6 lg:p-10 space-y-8">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-2">
              <Users className="size-7" />
              Clientes y roles
            </h1>
            <p className="text-muted-foreground mt-1">
              Gestiona cuentas de cliente, módulos contratados y asigna roles a
              usuarios internos o de cliente.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4 mr-2" />
            Nuevo cliente
          </Button>
        </div>

        {/* Client accounts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="size-4" />
              Cuentas de cliente
            </CardTitle>
            <CardDescription>
              Negocios con suscripción. Edita módulos contratados y estado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-6">
                <Loader2 className="size-4 animate-spin" /> Cargando clientes…
              </div>
            ) : clients.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                Aún no hay clientes. Crea el primero con “Nuevo cliente”.
              </div>
            ) : (
              <div className="space-y-2">
                {clients.map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3"
                  >
                    <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="size-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium truncate">{c.businessName}</span>
                        <Badge className={STATUS_BADGE[c.status] || "bg-muted text-muted-foreground"}>
                          {STATUS_LABEL[c.status] || c.status}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {c.plan}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {c.contactEmail} · {c.modules.length} módulo(s) · creado{" "}
                        {format(new Date(c.createdAt), "d MMM yyyy", { locale: es })}
                      </div>
                      {c.modules.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {c.modules.map((m) => (
                            <Badge
                              key={m}
                              variant="secondary"
                              className="text-[10px] py-0"
                            >
                              {MODULE_LABELS[m] || m}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => setEditClient(c)}
                        title="Editar"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 hover:text-destructive"
                        onClick={() => deleteClient(c)}
                        title="Eliminar"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Profiles & roles */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="size-4" />
                  Usuarios y roles
                </CardTitle>
                <CardDescription>
                  Asigna roles a usuarios registrados. El rol controla qué ven en
                  el panel.
                </CardDescription>
              </div>
              <Button variant="outline" onClick={() => { setAssignOpen(true); setAssignEmail(""); }}>
                <ShieldCheck className="size-4 mr-2" />
                Asignar rol
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, email o rol…"
                className="pl-9"
              />
            </div>
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-6">
                <Loader2 className="size-4 animate-spin" /> Cargando usuarios…
              </div>
            ) : filteredProfiles.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                No se encontraron usuarios.
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto pf-scroll space-y-1.5">
                {filteredProfiles.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center gap-3 rounded-md border border-border p-2.5 hover:bg-accent/40 transition-colors"
                  >
                    <div className="size-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                      <Mail className="size-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {p.fullName || p.email}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {p.email}
                        {p.clientAccount?.businessName
                          ? ` · ${p.clientAccount.businessName}`
                          : ""}
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">
                      {ROLE_LABELS[p.role] || p.role}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        p.status === "active"
                          ? "border-emerald-400 text-emerald-600"
                          : "text-muted-foreground"
                      }
                    >
                      {p.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create / edit dialogs */}
      <ClientFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={load}
      />
      {editClient && (
        <ClientFormDialog
          open={!!editClient}
          onOpenChange={(o) => !o && setEditClient(null)}
          client={editClient}
          onSaved={load}
        />
      )}

      <AssignRoleDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        defaultEmail={assignEmail}
        onSaved={load}
      />
    </div>
  );
}

function ClientFormDialog({
  open,
  onOpenChange,
  client,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  client?: ClientAccountItem;
  onSaved: () => void;
}) {
  const isEdit = !!client;
  const [businessName, setBusinessName] = useState(client?.businessName || "");
  const [contactEmail, setContactEmail] = useState(client?.contactEmail || "");
  const [plan, setPlan] = useState(client?.plan || "trimestral");
  const [status, setStatus] = useState(client?.status || CLIENT_STATUS.PENDING_REVIEW);
  const [modules, setModules] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const m of ALL_MODULES) {
      initial[m] = client?.modules?.includes(m) ?? false;
    }
    return initial;
  });
  const [saving, setSaving] = useState(false);

  // Reset fields when dialog opens for a different client
  useEffect(() => {
    if (!open) return;
    setBusinessName(client?.businessName || "");
    setContactEmail(client?.contactEmail || "");
    setPlan(client?.plan || "trimestral");
    setStatus(client?.status || CLIENT_STATUS.PENDING_REVIEW);
    const next: Record<string, boolean> = {};
    for (const m of ALL_MODULES) next[m] = client?.modules?.includes(m) ?? false;
    setModules(next);
  }, [open, client]);

  async function submit() {
    if (!businessName.trim() || !contactEmail.trim()) {
      toast.error("Rellena el nombre del negocio y el email de contacto.");
      return;
    }
    setSaving(true);
    try {
      const moduleKeys = ALL_MODULES.filter((m) => modules[m]);
      const url = isEdit ? `/api/admin/clients/${client!.id}` : "/api/admin/clients";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: businessName.trim(),
          contactEmail: contactEmail.trim().toLowerCase(),
          plan,
          status,
          modules: moduleKeys,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || "Error al guardar el cliente");
        return;
      }
      toast.success(isEdit ? "Cliente actualizado" : "Cliente creado");
      onOpenChange(false);
      onSaved();
    } catch {
      toast.error("Error de red");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Actualiza los datos del negocio y los módulos contratados."
              : "Crea una cuenta de cliente y define qué módulos tendrá disponibles."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pf-scroll pr-1">
          <div className="space-y-2">
            <Label htmlFor="client-name">Nombre del negocio</Label>
            <Input
              id="client-name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Acme Inc."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-email">Email de contacto</Label>
            <Input
              id="client-email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="contacto@acme.com"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trimestral">Trimestral</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CLIENT_STATUS.PENDING_REVIEW}>Pendiente</SelectItem>
                  <SelectItem value={CLIENT_STATUS.ACTIVE}>Activo</SelectItem>
                  <SelectItem value={CLIENT_STATUS.SUSPENDED}>Suspendido</SelectItem>
                  <SelectItem value={CLIENT_STATUS.CANCELLED}>Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Módulos contratados</Label>
            <div className="grid gap-2">
              {ALL_MODULES.map((m) => (
                <label
                  key={m}
                  className="flex items-center justify-between gap-3 rounded-md border border-border p-2.5 cursor-pointer hover:bg-accent/40"
                >
                  <span className="text-sm">{MODULE_LABELS[m] || m}</span>
                  <Switch
                    checked={modules[m] || false}
                    onCheckedChange={(v) =>
                      setModules((prev) => ({ ...prev, [m]: v }))
                    }
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
            {isEdit ? "Guardar cambios" : "Crear cliente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignRoleDialog({
  open,
  onOpenChange,
  defaultEmail,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultEmail: string;
  onSaved: () => void;
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [role, setRole] = useState<string>(ROLES.OPERATOR);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail(defaultEmail);
      setRole(ROLES.OPERATOR);
    }
  }, [open, defaultEmail]);

  async function submit() {
    if (!email.trim()) {
      toast.error("Introduce un email.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/assign-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), role }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || "Error al asignar el rol");
        return;
      }
      toast.success("Rol actualizado");
      onOpenChange(false);
      onSaved();
    } catch {
      toast.error("Error de red");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Asignar rol a usuario</DialogTitle>
          <DialogDescription>
            Cambia el rol de un usuario registrado. Esto afecta los menús y
            permisos del panel.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="assign-email">Email del usuario</Label>
            <Input
              id="assign-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@correo.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Rol</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r] || r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
            Asignar rol
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
