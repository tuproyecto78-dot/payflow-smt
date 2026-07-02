// /safe-home — A totally independent static page used to diagnose whether
// the preview is broken or just the root "/" route.
//
// This page has:
//   - NO client-side JavaScript
//   - NO fetch calls
//   - NO PayPhone, Supabase, or session dependencies
//   - NO AuthProvider, AppProvider, Sidebar, or Dashboard imports
//
// It renders pure HTML so we can verify the dev server serves HTML correctly.

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const metadata = {
  title: "PayFlow SMT — Safe Home",
  description: "Página de diagnóstico independiente.",
};

export default function SafeHomePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#061426",
        color: "#ffffff",
        fontFamily:
          "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        padding: "24px",
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: 480 }}>
        <h1 style={{ fontSize: 40, fontWeight: 800, marginBottom: 12 }}>
          PayFlow SMT
        </h1>
        <p
          style={{
            fontSize: 20,
            color: "#00D084",
            marginBottom: 32,
            fontWeight: 600,
          }}
        >
          Aplicación funcionando
        </p>

        <a
          href="/"
          style={{
            display: "inline-block",
            padding: "12px 28px",
            borderRadius: 10,
            background: "#00D084",
            color: "#061426",
            fontWeight: 700,
            textDecoration: "none",
            fontSize: 15,
          }}
        >
          Volver al inicio
        </a>
      </div>
    </div>
  );
}
