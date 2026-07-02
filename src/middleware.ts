import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isSupabaseConfigured, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

/**
 * Middleware que:
 * 1. Refresca la sesión de Supabase en cada petición.
 * 2. Agrega headers de seguridad a todas las respuestas.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  // ─── Headers de seguridad ────────────────────────────────────────
  // En desarrollo, relajar CSP para no bloquear scripts de Next.js/Turbopack.
  // En producción, usar CSP más estricta.
  const isDev = process.env.NODE_ENV !== "production";
  const csp = isDev
    ? [
        "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' data:",
        "img-src 'self' data: blob: https:",
        "connect-src 'self' https://*.supabase.co https://api.openai.com https://generativelanguage.googleapis.com https://pay.payphonelab.com https://api.deuna.io https://api.stripe.com ws: wss:",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; ")
    : [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' data:",
        "img-src 'self' data: blob: https:",
        "connect-src 'self' https://*.supabase.co https://api.openai.com https://generativelanguage.googleapis.com https://pay.payphonelab.com https://api.deuna.io https://api.stripe.com",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; ");

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  response.headers.set("X-DNS-Prefetch-Control", "on");

  // ─── Sesión Supabase ────────────────────────────────────────────
  if (isSupabaseConfigured) {
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request: { headers: request.headers } });
          // Re-aplicar headers de seguridad al nuevo response.
          response.headers.set("Content-Security-Policy", csp);
          response.headers.set("X-Frame-Options", "DENY");
          response.headers.set("X-Content-Type-Options", "nosniff");
          response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
          response.headers.set(
            "Permissions-Policy",
            "camera=(), microphone=(), geolocation=()"
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    await supabase.auth.getUser();
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
