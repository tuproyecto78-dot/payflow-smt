import Link from "next/link";

export const metadata = {
  title: "Términos y Condiciones — PayFlow SMT",
  description: "Términos y Condiciones de PayFlow SMT",
};

export const dynamic = "force-dynamic";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="font-bold text-lg">PayFlow SMT</Link>
          <Link href="/" className="text-sm text-primary hover:underline">Volver al inicio</Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8 prose dark:prose-invert max-w-none">
        <h1>Términos y Condiciones</h1>
        <p className="text-muted-foreground">Última actualización: Junio 2026 · Versión 1.0</p>

        <h2>1. Naturaleza del servicio</h2>
        <p>PayFlow SMT es una plataforma SaaS que permite crear flujos de automatización de WhatsApp, gestionar pagos electrónicos, agentes de inteligencia artificial, catálogo de productos, agenda de citas y integraciones API/webhook. El servicio se presta bajo suscripción y no constituye una relación laboral ni societaria.</p>

        <h2>2. Uso permitido</h2>
        <p>El servicio se proporciona para uso comercial legítimo. El usuario se compromete a:</p>
        <ul>
          <li>No utilizar la plataforma para actividades ilegales, fraude o spam.</li>
          <li>No enviar mensajes no solicitados a clientes que no hayan dado su consentimiento.</li>
          <li>Cumplir con las políticas de WhatsApp Business y Meta Platforms.</li>
          <li>Proporcionar información veraz y actualizada sobre su negocio.</li>
          <li>No intentar acceder a datos de otros clientes sin autorización.</li>
        </ul>

        <h2>3. Responsabilidad del negocio</h2>
        <p>El negocio cliente es responsable de:</p>
        <ul>
          <li>La información que comparte con sus clientes a través de la plataforma.</li>
          <li>El cumplimiento de las normativas locales de protección al consumidor.</li>
          <li>La veracidad de precios, stock, horarios y políticas publicadas.</li>
          <li>La entrega de productos y servicios ofrecidos.</li>
          <li>La atención de reclamos y devoluciones según sus propias políticas.</li>
        </ul>

        <h2>4. Pagos</h2>
        <p>Los pagos se procesan a través de PayPhone. PayFlow SMT no almacena datos de tarjetas, CVV ni información financiera sensible. El procesamiento de pagos está sujeto a los términos y condiciones de PayPhone. La confirmación de pagos exitosos se realiza exclusivamente mediante el webhook de PayPhone, no por el Agente IA.</p>

        <h2>5. WhatsApp y terceros</h2>
        <p>El uso de WhatsApp Business Cloud API está sujeto a los términos de Meta Platforms, Inc. PayFlow SMT no se responsabiliza por bloqueos, restricciones o suspensiones impuestas por Meta o terceros. El negocio cliente debe cumplir con las políticas de mensajería de WhatsApp, incluyendo opt-in de los clientes para recibir mensajes.</p>

        <h2>6. Inteligencia artificial</h2>
        <p>PayFlow SMT utiliza agentes de IA para automatizar conversaciones. Las respuestas generadas por la IA se basan exclusivamente en la información cargada por el administrador del negocio. La IA no inventa precios, stock, horarios ni políticas. Si la IA no encuentra la información, deriva la conversación a un asesor humano. PayFlow SMT no se responsabiliza por respuestas incorrectas si la información cargada por el negocio es errónea.</p>

        <h2>7. Disponibilidad</h2>
        <p>PayFlow SMT se esfuerza por mantener una disponibilidad del 99.5% mensual. No garantizamos disponibilidad ininterrumpida y no nos hacemos responsables por interrupciones causadas por:</p>
        <ul>
          <li>Mantenimiento programado.</li>
          <li>Fallas de proveedores externos (PayPhone, Meta, proveedores de IA).</li>
          <li>Fuerza mayor o eventos fuera de nuestro control.</li>
          <li>Problemas de conectividad del cliente.</li>
        </ul>

        <h2>8. Seguridad</h2>
        <p>Implementamos medidas de seguridad técnicas y organizativas: cifrado HTTPS, control de acceso por roles, tokens almacenados solo en backend, no exposición de credenciales, y auditoría de acciones. Sin embargo, ningún sistema es 100% seguro. El cliente debe mantener sus credenciales de acceso seguras y notificar cualquier uso no autorizado.</p>

        <h2>9. Limitación de responsabilidad</h2>
        <p>PayFlow SMT no será responsable por:</p>
        <ul>
          <li>Daños indirectos, incidentales o consecuentes.</li>
          <li>Pérdida de ingresos, clientes o datos derivados del uso del servicio.</li>
          <li>Acciones u omisiones de proveedores externos (PayPhone, Meta, IA).</li>
          <li>Información incorrecta cargada por el negocio cliente.</li>
        </ul>
        <p>La responsabilidad total de PayFlow SMT está limitada al monto pagado por el cliente en los últimos 3 meses de suscripción.</p>

        <h2>10. Protección de datos</h2>
        <p>El tratamiento de datos personales se rige por nuestra <Link href="/privacy" className="text-primary hover:underline">Política de Privacidad</Link>. El cliente es responsable del tratamiento de los datos de sus propios clientes y debe cumplir con la normativa de protección de datos aplicable en su jurisdicción.</p>

        <h2>11. Cambios</h2>
        <p>Podemos actualizar estos Términos y Condiciones en cualquier momento. Los cambios se publicarán en esta página con la fecha de actualización. El uso continuado de la plataforma después de los cambios constituye la aceptación de los términos actualizados.</p>
      </main>
    </div>
  );
}
