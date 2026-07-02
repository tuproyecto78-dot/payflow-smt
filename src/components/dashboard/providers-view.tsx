"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import {
  CreditCard,
  Smartphone,
  Wallet,
  DollarSign,
  ShoppingCart,
  Code,
  Loader2,
  Zap,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

// Provider shape returned by GET /api/payments/providers
interface ProviderStatus {
  provider: string;
  configured: boolean;
  mode: "sandbox" | "production";
  missingVars: string[];
}

// Shape returned by POST /api/payments/providers/test
interface ProviderTestResult {
  ok: boolean;
  provider: string;
  result: "success" | "not_configured" | "skipped" | "error";
  message: string;
  tested_at: string;
}

const PROVIDER_META: Record<
  string,
  { label: string; icon: React.ReactNode; description: string }
> = {
  Mock: {
    label: "Mock",
    icon: <CreditCard className="size-5 text-primary" />,
    description: "Proveedor simulado para desarrollo y pruebas.",
  },
  PayPhone: {
    label: "PayPhone",
    icon: <Smartphone className="size-5 text-primary" />,
    description: "Cobros directos por WhatsApp (Ecuador).",
  },
  DEUNA: {
    label: "DEUNA",
    icon: <Wallet className="size-5 text-primary" />,
    description: "Links de pago LATAM multi-moneda.",
  },
  Stripe: {
    label: "Stripe",
    icon: <CreditCard className="size-5 text-primary" />,
    description: "Checkout global con tarjetas y métodos locales.",
  },
  PayPal: {
    label: "PayPal",
    icon: <DollarSign className="size-5 text-primary" />,
    description: "Checkout PayPal y tarjetas internacionales.",
  },
  "Mercado Pago": {
    label: "Mercado Pago",
    icon: <ShoppingCart className="size-5 text-primary" />,
    description: "Checkout Pro LATAM multi-moneda.",
  },
  "API personalizada": {
    label: "API personalizada",
    icon: <Code className="size-5 text-primary" />,
    description: "Conector HTTP configurable por nodo.",
  },
};

function StatusBadge({ configured }: { configured: boolean }) {
  if (configured) {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
        <ShieldCheck className="size-3 mr-1" /> Configurado
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
      <AlertTriangle className="size-3 mr-1" /> No configurado
    </Badge>
  );
}

function ModeBadge({ mode }: { mode: "sandbox" | "production" }) {
  if (mode === "production") {
    return (
      <Badge className="bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400">
        Producción
      </Badge>
    );
  }
  return (
    <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400">
      Sandbox
    </Badge>
  );
}

export function ProvidersView() {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [loading, setLoading] = useState(true);
  // Per-provider "última prueba" timestamp (ISO string)
  const [lastTests, setLastTests] = useState<Record<string, string>>({});
  // Per-provider in-flight test request
  const [testing, setTesting] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/payments/providers", { cache: "no-store" });
      if (!res.ok) {
        toast.error("Error al cargar proveedores");
        return;
      }
      const data = (await res.json()) as { providers: ProviderStatus[] };
      setProviders(data.providers || []);
    } catch {
      toast.error("Error de red");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function testProvider(provider: string) {
    setTesting((prev) => ({ ...prev, [provider]: true }));
    try {
      const res = await fetch("/api/payments/providers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const data = (await res.json()) as ProviderTestResult & { error?: string };
      const testedAt = data.tested_at || new Date().toISOString();
      setLastTests((prev) => ({ ...prev, [provider]: testedAt }));

      if (!res.ok) {
        toast.error(data.error || data.message || "Error al probar proveedor");
        return;
      }

      if (data.ok && data.result === "success") {
        toast.success(`${provider}: conexión exitosa`);
      } else if (data.result === "skipped") {
        toast.info(`${provider}: ${data.message}`);
      } else if (data.result === "not_configured") {
        toast.warning(`${provider}: no configurado`);
      } else {
        toast.error(`${provider}: ${data.message || "falló la prueba"}`);
      }
    } catch {
      toast.error("Error de red al probar proveedor");
    } finally {
      setTesting((prev) => ({ ...prev, [provider]: false }));
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Sticky header */}
      <div className="p-5 border-b border-border shrink-0">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <CreditCard className="size-5 text-primary" />
          Proveedores de pago
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configura y prueba los proveedores de pago. Las claves se gestionan
          desde el backend.
        </p>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto pf-scroll">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="size-5 animate-spin mr-2" />
            Cargando proveedores…
          </div>
        ) : providers.length === 0 ? (
          <div className="p-6 max-w-5xl mx-auto">
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center text-center py-16">
                <CreditCard className="size-10 mb-3 opacity-40 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">
                  No se encontraron proveedores.
                </p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6 max-w-5xl mx-auto">
            {providers.map((p) => {
              const meta = PROVIDER_META[p.provider] || {
                label: p.provider,
                icon: <CreditCard className="size-5 text-primary" />,
                description: "",
              };
              const last = lastTests[p.provider];
              const isTesting = !!testing[p.provider];
              return (
                <Card key={p.provider} className="flex flex-col">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          {meta.icon}
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-sm truncate">
                            {meta.label}
                          </CardTitle>
                          <CardDescription className="text-xs mt-0.5">
                            {meta.description}
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 flex-1">
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge configured={p.configured} />
                      <ModeBadge mode={p.mode} />
                    </div>

                    {p.missingVars.length > 0 && (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        Faltan:{" "}
                        <span className="font-mono">
                          {p.missingVars.join(", ")}
                        </span>
                      </p>
                    )}

                    <p className="text-xs text-muted-foreground">
                      Última prueba:{" "}
                      <span className="font-medium text-foreground">
                        {last ? formatDateTime(last) : "Nunca"}
                      </span>
                    </p>
                  </CardContent>

                  <CardFooter className="mt-auto">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => testProvider(p.provider)}
                      disabled={isTesting}
                    >
                      {isTesting ? (
                        <>
                          <Loader2 className="size-4 mr-2 animate-spin" />
                          Probando…
                        </>
                      ) : (
                        <>
                          <Zap className="size-4 mr-2" />
                          Probar conexión
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}

            {/* Security note */}
            <div className="col-span-full mt-2">
              <p
                className={cn(
                  "text-xs text-muted-foreground text-center",
                  "rounded-lg border border-border bg-muted/30 px-4 py-3"
                )}
              >
                Las claves se configuran mediante variables de entorno en el
                backend. Por seguridad, no se pueden editar ni copiar desde aquí.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
