"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Scale, FileText, Cookie, Mail, ShieldCheck } from "lucide-react";

const LEGAL_LINKS = [
  {
    href: "/privacy",
    title: "Política de Privacidad",
    description:
      "Cómo recopilamos, usamos y protegemos los datos personales de los usuarios.",
    icon: ShieldCheck,
  },
  {
    href: "/terms",
    title: "Términos y Condiciones",
    description:
      "Reglas de uso del servicio, responsabilidad del negocio y limitaciones.",
    icon: FileText,
  },
  {
    href: "/cookies",
    title: "Política de Cookies",
    description:
      "Tipos de cookies que utilizamos y cómo puedes desactivarlas.",
    icon: Cookie,
  },
  {
    href: "/data-request",
    title: "Solicitar gestión de datos",
    description:
      "Formulario para que los titulares ejerzan sus derechos ARCO+.",
    icon: Mail,
  },
];

export function LegalView() {
  return (
    <div className="flex-1 overflow-y-auto pf-scroll">
      <div className="max-w-4xl mx-auto p-6 lg:p-10 space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Scale className="size-7" />
            Legal
          </h1>
          <p className="text-muted-foreground mt-1">
            Documentos legales y formularios de derechos del titular.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {LEGAL_LINKS.map((l) => {
            const Icon = l.icon;
            return (
              <Card key={l.href} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="size-5 text-primary" />
                    </div>
                    <CardTitle className="text-base">{l.title}</CardTitle>
                  </div>
                  <CardDescription className="mt-2">{l.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto">
                  <Button asChild variant="outline" size="sm">
                    <a href={l.href}>Abrir documento</a>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
