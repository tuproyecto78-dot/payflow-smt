import Link from "next/link";

export const metadata = {
  title: "Política de Cookies — PayFlow SMT",
  description: "Política de Cookies de PayFlow SMT",
};

export const dynamic = "force-dynamic";

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="font-bold text-lg">PayFlow SMT</Link>
          <Link href="/" className="text-sm text-primary hover:underline">Volver al inicio</Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8 prose dark:prose-invert max-w-none">
        <h1>Política de Cookies</h1>
        <p className="text-muted-foreground">Última actualización: Junio 2026 · Versión 1.0</p>

        <h2>1. ¿Qué son las cookies?</h2>
        <p>Las cookies son pequeños archivos de texto que un sitio web almacena en el navegador del usuario cuando lo visita. Permiten al sitio recordar información sobre la visita, como preferencias de idioma, datos de sesión y estado de autenticación, facilitando la navegación y mejorando la experiencia del usuario.</p>

        <h2>2. Cookies necesarias</h2>
        <p>Estas cookies son esenciales para el funcionamiento del sitio web. Sin ellas, no podríamos ofrecer funciones como inicio de sesión, gestión de suscripción o acceso al panel de control.</p>
        <ul>
          <li><strong>Cookie de sesión:</strong> identifica al usuario autenticado. Se elimina al cerrar el navegador.</li>
          <li><strong>Cookie de preferencias:</strong> recuerda el tema (claro/oscuro) y el idioma seleccionado.</li>
          <li><strong>Cookie CSRF:</strong> protege formularios contra ataques de falsificación de petición.</li>
        </ul>
        <p>Estas cookies no requieren consentimiento, ya que son necesarias para el servicio solicitado.</p>

        <h2>3. Cookies de seguridad</h2>
        <p>Utilizamos cookies para mantener la seguridad de la sesión:</p>
        <ul>
          <li><strong>Token de sesión:</strong> cookie httpOnly que identifica al usuario autenticado. Nunca se expone a JavaScript del lado del cliente.</li>
          <li><strong>Token de autenticación:</strong> valida que la sesión sea legítima y no haya sido manipulada.</li>
        </ul>
        <p>Estas cookies se eliminan al cerrar sesión o al expirar (7 días).</p>

        <h2>4. Cookies de analítica</h2>
        <p>Actualmente PayFlow SMT no utiliza cookies de analítica de terceros (Google Analytics, Mixpanel, etc.) en el entorno de desarrollo. En producción, si se activan, se solicitará consentimiento explícito antes de instalarlas. Las cookies de analítica recopilarían:</p>
        <ul>
          <li>Páginas visitadas y tiempo de permanencia.</li>
          <li>Fuente de tráfico (orgánico, directo, referido).</li>
          <li>Tipo de dispositivo y navegador.</li>
        </ul>
        <p>Los datos serían anonimizados y utilizados únicamente para mejorar el servicio.</p>

        <h2>5. Cómo desactivar las cookies</h2>
        <p>Puedes gestionar o eliminar las cookies desde la configuración de tu navegador en cualquier momento:</p>
        <ul>
          <li><strong>Google Chrome:</strong> Configuración → Privacidad y seguridad → Cookies.</li>
          <li><strong>Mozilla Firefox:</strong> Preferencias → Privacidad y seguridad → Cookies.</li>
          <li><strong>Safari:</strong> Preferencias → Privacidad → Cookies.</li>
          <li><strong>Microsoft Edge:</strong> Configuración → Cookies y permisos del sitio.</li>
        </ul>
        <p>Ten en cuenta que desactivar las cookies necesarias puede afectar el funcionamiento del sitio (no podrás iniciar sesión, por ejemplo).</p>
        <p className="mt-8 text-sm text-muted-foreground">Para consultas sobre cookies, visita: <Link href="/data-request" className="text-primary hover:underline">Solicitud de gestión de datos personales</Link>.</p>
      </main>
    </div>
  );
}
