# Security Checklist — PayFlow SMT

Checklist de seguridad para producción.

## ✅ Supabase Auth
- [x] Login y signup protegidos con rate limiting (10 intentos/min login, 5/min signup)
- [x] Logout disponible
- [x] Sesión se refresca automáticamente vía middleware
- [x] Rutas internas protegidas (dashboard, editor, ejecuciones requieren sesión)

## ✅ Row Level Security (RLS)
- [x] RLS activado en todas las tablas en `supabase/schema.sql`
- [x] Cada usuario solo ve/modifica sus propios datos (`auth.uid() = user_id`)
- [x] `subscription_requests`: INSERT público, SELECT/UPDATE solo autenticados
- [x] Nadie puede leer datos de otros usuarios

## ✅ Protección de claves
- [x] `PAYPHONE_TOKEN`, `PAYPHONE_STORE_ID` — solo backend (server-side)
- [x] `GEMINI_API_KEY`, `OPENAI_API_KEY`, `AI_PROVIDER` — solo backend
- [x] `STRIPE_SECRET_KEY` — solo backend
- [x] `DEUNA_API_KEY`, `DEUNA_MERCHANT_ID` — solo backend
- [x] Solo `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` son públicas
- [x] Service role key nunca se usa en frontend

## ✅ APIs internas seguras
- [x] `/api/payments/create` — requiere sesión + rate limit + validación de monto/proveedor
- [x] `/api/payments/webhook` — rate limit + idempotencia por provider_payment_id
- [x] `/api/ai/payment-agent` — rate limit + sanitización de mensaje + límite de tamaño
- [x] `/api/subscriptions` — rate limit + validación + sanitización XSS
- [x] `/api/auth/login` — rate limit + validación de email
- [x] `/api/auth/signup` — rate limit + validación de email
- [x] `user_id` siempre se toma de la sesión, nunca del cliente
- [x] Errores genéricos (no exponen detalles internos)

## ✅ Validación de datos
- [x] Email con regex válido
- [x] Teléfono formato internacional
- [x] Código de país numérico (1-4 dígitos)
- [x] Cédula/DNI alfanumérico (5-20 caracteres)
- [x] Monto > 0 y ≤ 1,000,000
- [x] Moneda en lista de permitidas (USD, EUR, etc.)
- [x] Proveedor en lista de permitidos (Mock, PayPhone, DEUNA, Stripe, API personalizada)
- [x] Sanitización XSS en todos los campos de texto (`sanitizeText`, `sanitizeName`)

## ✅ Webhooks
- [x] Idempotencia por provider_payment_id (no procesa dos veces el mismo estado)
- [x] Confirma provider_payment_id antes de marcar `payment_success`
- [x] Rate limiting (60 req/min por IP)
- [x] Auditoría de cambios de estado

## ✅ Rate Limiting
| Endpoint | Límite | Ventana |
|----------|--------|---------|
| `/api/auth/login` | 10 | 60s |
| `/api/auth/signup` | 5 | 60s |
| `/api/subscriptions` (POST) | 3 | 60s |
| `/api/payments/create` | 20 | 60s |
| `/api/payments/webhook` | 60 | 60s |
| `/api/ai/payment-agent` | 30 | 60s |

## ✅ Seguridad de IA
- [x] Claves de Gemini/OpenAI nunca se envían al frontend
- [x] Mensaje del cliente se sanitiza y se limita a 1000 caracteres
- [x] La IA no puede escribir en `payment_status` ni `payment_outcome` (PROTECTED set)
- [x] Solo PayPhone, webhook o verificación backend puede marcar `payment_success`

## ✅ Logs seguros
- [x] Logs de ejecución guardan: nodo, estado, mensaje, timestamp, workflow_run_id
- [x] NUNCA se guardan tokens, API keys, secretos o credenciales
- [x] Cédula/DNI se muestra mascarada en UI: `******5678`

## ✅ Headers de seguridad
- [x] Content-Security-Policy básica
- [x] X-Frame-Options: DENY
- [x] X-Content-Type-Options: nosniff
- [x] Referrer-Policy: strict-origin-when-cross-origin
- [x] Permissions-Policy: camera/microphone/geolocation deshabilitados

## ✅ Auditoría
- [x] Tabla `audit_logs` con: id, user_id, action, entity_type, entity_id, ip_address, user_agent, metadata, created_at
- [x] Registra: login, payment_created, payment_status_changed
- [x] No guarda datos sensibles en metadata

## ✅ Formularios
- [x] Suscripción: validación + sanitización + rate limit anti-spam
- [x] Estado inicial: `pending_review` (no se activa automáticamente)

## ✅ Workflows
- [x] Cada workflow tiene owner (user_id)
- [x] Cada project tiene owner (user_id)
- [x] No se pueden cargar/modificar workflows ajenos (verificado en cada ruta)
- [x] `user_id` se toma de la sesión, no del cliente

## ✅ Modo Mock
- [x] Mock funciona sin claves reales
- [x] Fallback automático sin credenciales

## Producción
Antes de desplegar:
1. Ejecutar `supabase/schema.sql` en Supabase
2. Configurar todas las variables de entorno privadas en Vercel
3. Verificar que RLS está activo
4. Verificar que las claves no están en el código
5. Probar rate limiting
6. Probar idempotencia del webhook
