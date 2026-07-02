"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Lock,
  Sparkles,
  ArrowRight,
  Loader2,
  Inbox,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import {
  MODULES,
  MODULE_LABELS,
  ALL_MODULES,
} from "@/lib/roles";

interface SubscriptionRequestItem {
  id: string;
  selectedPlanLabel: string | null;
  selectedPlan: string;
  businessName: string | null;
  subscriptionStatus: string;
  createdAt: string;
}

interface ProfileResponse {
  profile: {
    fullName: string | null;
    role: string;
    status: string;
    clientId: string | null;
    clientStatus: string | null;
    modules: string[];
  } | null;
  subscriptionRequests: SubscriptionRequestItem[];
  clientAccount: {
    id: string;
    businessName: string;
    status: string;
    modules: string[];
  } | null;
}

const STATUS_META: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  pending_review: {
    label: "En revisión",
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
    icon: <Clock className="size-3.5" />,
  },
  contacted: {
    label: "Contactado",
    cls: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",
    icon: <Clock className="size-3.5" />,
  },
  active: {
    label: "Activo",
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
    icon: <CheckCircle2 className="size-3.5" />,
  },
  rejected: {
    label: "Rechazado",
    cls: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
    icon: <XCircle className="size-3.5" />,
  },
};

export function ApplicantView() {
  const { user } = useAuthStore();
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/profile", { cache: "no-store" });
      if (!res.ok) {
        setData(null);
        return;
      }
      const json = (await res.json()) as ProfileResponse;
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const firstName =
    (user?.name || "").split(/\s+/)[0] || user?.email?.split("@")[0] || "amigo";

  const requests = data?.subscriptionRequests ?? [];
  const latestRequest = requests[0] ?? null;
  const clientAccount = data?.clientAccount ?? null;

  return (
    <div className="flex-1 overflow-y-auto pf-scroll">
      <div className="max-w-4xl mx-auto p-6 lg:p-10 space-y-6">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">
            Hola, {firstName} 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            Tu cuenta está siendo revisada. Te avisaremos cuando esté lista.
          </p>
        </div>

        {/* Status card */}
        <Card className="border-amber-300/60 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/5">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Lock className="size-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-base">Cuenta sin suscripción activa</CardTitle>
                <CardDescription>
                  Tu acceso a los módulos está bloqueado hasta que se apruebe tu
                  suscripción.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild>
                <a href="/#section-precios">
                  <Sparkles className="size-4 mr-2" />
                  Ver planes y precios
                  <ArrowRight className="size-4 ml-2" />
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href="/#section-precios">Solicitar suscripción</a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Subscription requests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Inbox className="size-4" />
              Estado de tu solicitud
            </CardTitle>
            <CardDescription>
              Aquí verás el avance de tu solicitud de suscripción.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                <Loader2 className="size-4 animate-spin" /> Cargando…
              </div>
            ) : latestRequest ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
                  <div>
                    <div className="text-sm font-medium">
                      {latestRequest.businessName || latestRequest.selectedPlanLabel || "Solicitud"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Plan: {latestRequest.selectedPlanLabel || latestRequest.selectedPlan}
                    </div>
                  </div>
                  <Badge
                    className={
                      STATUS_META[latestRequest.subscriptionStatus]?.cls ||
                      "bg-muted text-muted-foreground"
                    }
                  >
                    {STATUS_META[latestRequest.subscriptionStatus]?.icon}
                    {STATUS_META[latestRequest.subscriptionStatus]?.label ||
                      latestRequest.subscriptionStatus}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Te contactaremos al correo registrado en un plazo de 24-48 horas hábiles.
                </p>
              </div>
            ) : clientAccount ? (
              <div className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">
                      {clientAccount.businessName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Cuenta de cliente creada — estado: {clientAccount.status}
                    </div>
                  </div>
                  <Badge className="bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400">
                    <Clock className="size-3.5" />
                    En activación
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground py-4">
                Aún no has enviado una solicitud de suscripción.{" "}
                <a href="/#section-precios" className="text-primary hover:underline">
                  Ver planes →
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Blocked modules */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="size-4" />
              Módulos bloqueados
            </CardTitle>
            <CardDescription>
              Estos son los módulos que tendrás disponibles al activar tu suscripción.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {ALL_MODULES.map((key) => (
                <div
                  key={key}
                  className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-3"
                >
                  <div className="size-9 rounded-md bg-muted flex items-center justify-center">
                    <Lock className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {MODULE_LABELS[key] || key}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Bloqueado
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter>
            <p className="text-xs text-muted-foreground">
              Necesitas una suscripción activa para acceder a{" "}
              {ALL_MODULES.length} módulos incluyendo{" "}
              <strong>{MODULE_LABELS[MODULES.AI_AGENT]}</strong>,{" "}
              <strong>{MODULE_LABELS[MODULES.CATALOG]}</strong> y{" "}
              <strong>{MODULE_LABELS[MODULES.AGENDA]}</strong>.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
