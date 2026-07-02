"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2, ShieldCheck } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function DataRequestPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState("access");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/data-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: name,
          email,
          phone,
          request_type: type,
          message,
        }),
      });
      if (res.ok) {
        setDone(true);
      } else {
        const d = await res.json();
        alert(d.error || "Error al enviar la solicitud");
      }
    } catch {
      alert("Error de red");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="font-bold text-lg">PayFlow SMT</Link>
          <Link href="/" className="text-sm text-primary hover:underline">Volver al inicio</Link>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Solicitar gestión de datos personales</h1>
            <p className="text-sm text-muted-foreground mt-1">
              De acuerdo con la normativa de protección de datos, puedes ejercer tus derechos.
            </p>
          </div>
        </div>

        {done ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-500/10 p-6 text-center">
            <CheckCircle2 className="size-12 mx-auto text-emerald-600 mb-3" />
            <h2 className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">
              Solicitud enviada
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Hemos recibido tu solicitud. Te contactaremos por correo en un plazo máximo de 30 días hábiles.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre completo *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Tu nombre completo" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico *</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="tu@correo.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono (opcional)</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+593..." />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tipo de solicitud *</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="access">Acceso a mis datos</SelectItem>
                  <SelectItem value="rectification">Rectificación de datos</SelectItem>
                  <SelectItem value="deletion">Eliminación de mis datos</SelectItem>
                  <SelectItem value="opposition">Oposición al tratamiento</SelectItem>
                  <SelectItem value="portability">Portabilidad de datos</SelectItem>
                  <SelectItem value="other">Otra solicitud</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Mensaje (opcional)</Label>
              <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Detalla tu solicitud..." />
            </div>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting && <Loader2 className="size-4 mr-2 animate-spin" />}
              Enviar solicitud
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Tu solicitud será revisada por nuestro equipo. Te responderemos en un máximo de 30 días hábiles.
            </p>
          </form>
        )}

        <div className="mt-8 pt-6 border-t text-center text-sm text-muted-foreground">
          <Link href="/privacy" className="hover:text-primary">Política de Privacidad</Link>
          {" · "}
          <Link href="/terms" className="hover:text-primary">Términos y Condiciones</Link>
          {" · "}
          <Link href="/cookies" className="hover:text-primary">Política de Cookies</Link>
        </div>
      </main>
    </div>
  );
}
