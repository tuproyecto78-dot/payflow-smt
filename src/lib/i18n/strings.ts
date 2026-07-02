// Translation strings for PayFlow SMT (es/en).
// Used by backend modules (payments, subscription-agent, suggested-workflows)
// to produce localized messages without bundling a full i18n framework.

export type Language = "es" | "en";

type StringMap = Record<string, string>;

const ES: StringMap = {
  // Payment outcome messages
  "payphone.business_not_configured": "El comercio aún no tiene PayPhone Business configurado.",
  "payphone.customer_not_registered": "No encontramos este número registrado en PayPhone. Verifica el número o usa otro método de pago.",
  "payphone.sale_created": "Te enviamos una solicitud de cobro a PayPhone. Confirma el pago desde tu app PayPhone y te avisaremos aquí cuando esté aprobado.",
  "payphone.success": "✅ Tu pago fue confirmado correctamente. Gracias por tu compra.",
  "payphone.failed": "❌ El pago fue rechazado o no pudo completarse.",
  "payphone.pending": "⏳ Tu pago está pendiente de confirmación en PayPhone.",
  "payphone.error": "⚠️ Ocurrió un error procesando el pago.",

  // Generic payment status messages (used by Mock/DEUNA/Stripe/API)
  "payment.success": "✅ Tu pago fue confirmado correctamente. Gracias por tu compra.",
  "payment.failed": "❌ El pago fue rechazado o no pudo completarse. Puedes intentar nuevamente.",
  "payment.pending": "⏳ Tu pago está pendiente de confirmación. Te avisaremos cuando sea aprobado.",
  "payment.link_pending": "Te enviamos tu enlace de pago. Cuando se confirme el pago, te avisaremos por WhatsApp.",
  "payment.link_pending.stripe": "Te enviamos tu enlace seguro de pago. Cuando se confirme el pago, te avisaremos por WhatsApp.",
  "payment.link_pending.paypal": "Te enviamos el enlace para completar tu pago con PayPal. Cuando se confirme, te avisaremos por WhatsApp.",
  "payment.pending_with_link": "⏳ Tu pago está pendiente de confirmación. Puedes completar el pago aquí: {{payment_link}}",
  "payment.error": "⚠️ Ocurrió un error procesando el pago. Por favor intenta nuevamente.",
  "payment.currency_not_supported": "La moneda {{code}} no es compatible con {{provider}}; se usó el modo simulado.",

  // Workflow node labels & messages
  "workflow.start": "Inicio",
  "workflow.end": "Fin",
  "workflow.welcome_label": "WhatsApp bienvenida",
  "workflow.ai_label_default": "Agente IA de pagos",
  "workflow.create_payment_label": "Crear pago",
  "workflow.condition_success": "¿Pago exitoso?",
  "workflow.wa_success_label": "WhatsApp pago exitoso",
  "workflow.wa_failed_label": "WhatsApp pago fallido",
  "workflow.wa_pending_label": "WhatsApp pago pendiente",
  "workflow.wa_error_label": "WhatsApp error",
  "workflow.end_message": "Flujo completado",

  // Template names
  "template.orders.name": "Cobro de pedidos por WhatsApp",
  "template.appointments.name": "Cobro de citas por WhatsApp",
  "template.products.name": "Cobro de productos por WhatsApp",
  "template.services.name": "Cobro de servicios por WhatsApp",
  "template.tuition.name": "Cobro de cuotas por WhatsApp",
  "template.general.name": "Cobro general por WhatsApp",

  // Welcome messages
  "template.welcome.orders": "Hola 👋 Bienvenido a {{business_name}}. Te ayudaré a confirmar y pagar tu pedido por WhatsApp.",
  "template.welcome.appointments": "Hola 👋 Bienvenido a {{business_name}}. Te ayudaré a confirmar el pago de tu cita.",
  "template.welcome.products": "Hola 👋 Bienvenido a {{business_name}}. Te ayudaré a pagar tu compra por WhatsApp.",
  "template.welcome.services": "Hola 👋 Bienvenido a {{business_name}}. Te ayudaré a gestionar el pago de tu servicio.",
  "template.welcome.tuition": "Hola 👋 Bienvenido a {{business_name}}. Te ayudaré a confirmar el pago de tu cuota o matrícula.",
  "template.welcome.general": "Hola 👋 Bienvenido a {{business_name}}. Te ayudaré a realizar tu pago por WhatsApp.",

  // AI labels & prompts
  "template.ai_label.orders": "Agente IA pedido",
  "template.ai_label.appointments": "Agente IA cita",
  "template.ai_label.products": "Agente IA producto",
  "template.ai_label.services": "Agente IA servicio",
  "template.ai_label.tuition": "Agente IA cuota",

  "template.ai_prompt.orders": "Eres un agente de cobros para un restaurante. Pide: nombre del cliente, número de pedido, monto, y confirmación de pago. NUNCA confirmes pagos exitosos. Responde mensajes cortos.",
  "template.ai_prompt.appointments": "Eres un agente de cobros para una clínica. Pide: nombre del paciente, fecha de cita, servicio, monto, y confirmación de pago. NUNCA confirmes pagos exitosos.",
  "template.ai_prompt.products": "Eres un agente de cobros para una tienda. Pide: nombre del cliente, producto, cantidad, monto, y confirmación de pago. NUNCA confirmes pagos exitosos.",
  "template.ai_prompt.services": "Eres un agente de cobros para servicios. Pide: nombre del cliente, número de factura o referencia, servicio, monto, y confirmación de pago. NUNCA confirmes pagos exitosos.",
  "template.ai_prompt.tuition": "Eres un agente de cobros para una institución educativa. Pide: nombre del estudiante, concepto de pago, periodo, monto, y confirmación de pago. NUNCA confirmes pagos exitosos.",
  "template.ai_prompt.general": "Eres un agente de cobros por WhatsApp. Pide: nombre del cliente, motivo del pago, monto, y confirmación de pago. NUNCA confirmes pagos exitosos. Responde mensajes cortos.",

  // Payment descriptions
  "template.payment_desc.orders": "Pedido",
  "template.payment_desc.appointments": "Cita",
  "template.payment_desc.products": "Producto",
  "template.payment_desc.services": "Servicio",
  "template.payment_desc.tuition": "Cuota",
  "template.payment_desc.general": "Pago",

  // Subscription agent conversation messages
  "sub.greeting": "¡Hola! 👋 Soy el agente de PayFlow SMT. Te ayudaré a solicitar la activación de tu canal de pagos por WhatsApp. Con PayFlow Activación 24H, nosotros configuramos todo por ti. ¿Empezamos? Responde 'sí' para continuar.",
  "sub.ask_name": "¿Cuáles son tus nombres completos?",
  "sub.ask_document": "Gracias. Ahora envíame tu cédula o DNI.",
  "sub.ask_email": "Perfecto. ¿Cuál es tu correo electrónico?",
  "sub.ask_country_code": "¿Cuál es tu código de país? (Ej: 593 para Ecuador, 52 para México, 34 para España)",
  "sub.ask_phone": "¿Cuál es tu número de celular?",
  "sub.ask_business_name": "¿Cuál es el nombre de tu negocio?",
  "sub.ask_business_type": "¿Qué tipo de negocio tienes? (Tienda, Servicios, Restaurante, E-commerce, Profesional, Educación, Delivery, Otro)",
  "sub.ask_country": "¿En qué país estás?",
  "sub.ask_city": "¿En qué ciudad estás?",
  "sub.ask_language": "¿En qué idioma prefieres continuar?\n1️⃣ Español\n2️⃣ English\n\nResponde 1 o 2.",
  "sub.ask_currency": "¿En qué moneda deseas cobrar?\n1️⃣ USD — Dólar\n2️⃣ EUR — Euro\n3️⃣ MXN — Peso mexicano\n4️⃣ COP — Peso colombiano\n5️⃣ PEN — Sol peruano\n6️⃣ Otra\n\nResponde el número.",
  "sub.ask_plan": "¿Qué plan deseas contratar?\n1️⃣ Plan Trimestral — $25\n2️⃣ Plan Anual — $89\n\nResponde 1 o 2.",
  "sub.ask_provider": "¿Qué proveedor de pago prefieres?\n1️⃣ PayPhone\n2️⃣ DEUNA\n3️⃣ Stripe\n4️⃣ Otro\n5️⃣ Todavía no tengo\n\nResponde 1, 2, 3, 4 o 5.",
  "sub.ask_payphone_business": "¿Tienes PayPhone Business?\n1️⃣ Sí\n2️⃣ No\n3️⃣ En proceso\n\nResponde 1, 2 o 3.",
  "sub.ask_whatsapp_business": "¿Tienes WhatsApp Business?\n1️⃣ Sí\n2️⃣ No\n3️⃣ En proceso\n\nResponde 1, 2 o 3.",
  "sub.ask_what_to_charge": "¿Qué deseas cobrar por WhatsApp?\n1️⃣ Pedidos\n2️⃣ Citas\n3️⃣ Servicios\n4️⃣ Productos\n5️⃣ Cuotas\n6️⃣ Reservas\n7️⃣ Facturas\n\nResponde el número.",
  "sub.ask_monthly_payments": "¿Cuántos cobros aproximados recibes al mes? (Ej: 50, 100, 500)",
  "sub.ask_avg_amount": "¿Cuál es el monto promedio de cada cobro? (Ej: 25, 50, 100)",
  "sub.confirmation_received": "¡Gracias! 🎉 Hemos recibido tu solicitud. Nuestro equipo revisará tus datos y activará tu canal de pagos por WhatsApp lo antes posible. Con PayFlow Activación 24H, no tienes que configurar nada — nosotros lo hacemos por ti.",
  "sub.invalid": "No entendí tu respuesta. ¿Puedes repetirla?",
  "sub.invalid_email": "Ese correo no parece válido.",
  "sub.invalid_phone": "Ese número no parece válido.",
  "sub.confirm_question": "¿Confirmas que deseas enviar la solicitud? Responde 'sí' o 'no'.",
  "sub.cancelled": "No hay problema. Si deseas enviar la solicitud más tarde, vuelve a escribirnos.",

  // Summary labels
  "summary.title": "Estos son los datos recibidos:",
  "summary.name": "Nombre",
  "summary.document": "Cédula",
  "summary.email": "Correo",
  "summary.phone": "Celular",
  "summary.business": "Negocio",
  "summary.type": "Tipo",
  "summary.location": "País",
  "summary.plan": "Plan",
  "summary.provider": "Proveedor",
  "summary.payphone": "PayPhone Business",
  "summary.whatsapp": "WhatsApp Business",
  "summary.what_charge": "Qué cobra",
  "summary.monthly": "Cobros/mes",
  "summary.avg_amount": "Monto promedio",
  "summary.currency": "Moneda",
  "summary.language": "Idioma",
  "summary.score": "Puntaje de activación",
  "summary.template": "Plantilla recomendada",
  "summary.confirm": "¿Confirmas que deseas enviar la solicitud? Responde 'sí' o 'no'.",

  // Misc
  "common.yes": "Sí",
  "common.no": "No",
  "common.in_progress": "En proceso",

  // Readiness recommendations (subscription agent)
  "readiness.fully_ready": "El cliente está completamente listo para activar el canal de pagos.",
  "readiness.ready_to_activate": "El cliente está listo para revisión y posible activación del canal de pagos.",
  "readiness.needs_payphone": "El cliente aún no tiene PayPhone Business. Puede activarse en modo Mock o quedar pendiente de configuración.",
  "readiness.needs_whatsapp": "El cliente aún no tiene WhatsApp Business. Confirmar si se usará un número existente o si requiere asistencia.",
  "readiness.incomplete": "Faltan datos obligatorios para continuar con la revisión.",
  "readiness.needs_more": "Necesita revisión adicional antes de activar.",
};

const EN: StringMap = {
  "payphone.business_not_configured": "The merchant does not have PayPhone Business configured yet.",
  "payphone.customer_not_registered": "We couldn't find this number registered in PayPhone. Verify the number or use another payment method.",
  "payphone.sale_created": "We sent a payment request to PayPhone. Confirm the payment from your PayPhone app and we'll let you know here once it's approved.",
  "payphone.success": "✅ Your payment was confirmed successfully. Thank you for your purchase.",
  "payphone.failed": "❌ The payment was declined or could not be completed.",
  "payphone.pending": "⏳ Your payment is pending confirmation in PayPhone.",
  "payphone.error": "⚠️ An error occurred while processing the payment.",

  "payment.success": "✅ Your payment was confirmed successfully. Thank you for your purchase.",
  "payment.failed": "❌ The payment was declined or could not be completed. You can try again.",
  "payment.pending": "⏳ Your payment is pending confirmation. We'll let you know when it's approved.",
  "payment.link_pending": "We sent you a payment link. Once the payment is confirmed, we'll let you know via WhatsApp.",
  "payment.link_pending.stripe": "We sent you your secure payment link. Once the payment is confirmed, we'll let you know via WhatsApp.",
  "payment.link_pending.paypal": "We sent you the link to complete your PayPal payment. Once confirmed, we'll let you know via WhatsApp.",
  "payment.pending_with_link": "⏳ Your payment is pending confirmation. You can complete the payment here: {{payment_link}}",
  "payment.error": "⚠️ An error occurred while processing the payment. Please try again.",
  "payment.currency_not_supported": "Currency {{code}} is not supported by {{provider}}; fell back to simulated mode.",

  "workflow.start": "Start",
  "workflow.end": "End",
  "workflow.welcome_label": "WhatsApp welcome",
  "workflow.ai_label_default": "Payments AI Agent",
  "workflow.create_payment_label": "Create payment",
  "workflow.condition_success": "Payment successful?",
  "workflow.wa_success_label": "WhatsApp payment success",
  "workflow.wa_failed_label": "WhatsApp payment failed",
  "workflow.wa_pending_label": "WhatsApp payment pending",
  "workflow.wa_error_label": "WhatsApp error",
  "workflow.end_message": "Workflow completed",

  "template.orders.name": "Order collection via WhatsApp",
  "template.appointments.name": "Appointment collection via WhatsApp",
  "template.products.name": "Product collection via WhatsApp",
  "template.services.name": "Service collection via WhatsApp",
  "template.tuition.name": "Tuition collection via WhatsApp",
  "template.general.name": "General payment collection via WhatsApp",

  "template.welcome.orders": "Hi 👋 Welcome to {{business_name}}. I'll help you confirm and pay for your order via WhatsApp.",
  "template.welcome.appointments": "Hi 👋 Welcome to {{business_name}}. I'll help you confirm the payment for your appointment.",
  "template.welcome.products": "Hi 👋 Welcome to {{business_name}}. I'll help you pay for your purchase via WhatsApp.",
  "template.welcome.services": "Hi 👋 Welcome to {{business_name}}. I'll help you manage your service payment.",
  "template.welcome.tuition": "Hi 👋 Welcome to {{business_name}}. I'll help you confirm your tuition or installment payment.",
  "template.welcome.general": "Hi 👋 Welcome to {{business_name}}. I'll help you make your payment via WhatsApp.",

  "template.ai_label.orders": "Order AI Agent",
  "template.ai_label.appointments": "Appointment AI Agent",
  "template.ai_label.products": "Product AI Agent",
  "template.ai_label.services": "Service AI Agent",
  "template.ai_label.tuition": "Tuition AI Agent",

  "template.ai_prompt.orders": "You are a payment agent for a restaurant. Ask for: customer name, order number, amount, and payment confirmation. NEVER confirm successful payments. Keep replies short.",
  "template.ai_prompt.appointments": "You are a payment agent for a clinic. Ask for: patient name, appointment date, service, amount, and payment confirmation. NEVER confirm successful payments.",
  "template.ai_prompt.products": "You are a payment agent for a store. Ask for: customer name, product, quantity, amount, and payment confirmation. NEVER confirm successful payments.",
  "template.ai_prompt.services": "You are a payment agent for services. Ask for: customer name, invoice or reference number, service, amount, and payment confirmation. NEVER confirm successful payments.",
  "template.ai_prompt.tuition": "You are a payment agent for an educational institution. Ask for: student name, payment concept, period, amount, and payment confirmation. NEVER confirm successful payments.",
  "template.ai_prompt.general": "You are a WhatsApp payment agent. Ask for: customer name, payment reason, amount, and payment confirmation. NEVER confirm successful payments. Keep replies short.",

  "template.payment_desc.orders": "Order",
  "template.payment_desc.appointments": "Appointment",
  "template.payment_desc.products": "Product",
  "template.payment_desc.services": "Service",
  "template.payment_desc.tuition": "Tuition",
  "template.payment_desc.general": "Payment",

  "sub.greeting": "Hi! 👋 I'm the PayFlow SMT agent. I'll help you request activation of your payment channel via WhatsApp. With PayFlow 24H Activation, we configure everything for you. Shall we begin? Reply 'yes' to continue.",
  "sub.ask_name": "What is your full name?",
  "sub.ask_document": "Thanks. Now send me your ID or passport number.",
  "sub.ask_email": "Perfect. What is your email address?",
  "sub.ask_country_code": "What is your country code? (e.g. 1 for US, 52 for Mexico, 34 for Spain)",
  "sub.ask_phone": "What is your mobile number?",
  "sub.ask_business_name": "What is the name of your business?",
  "sub.ask_business_type": "What type of business do you have? (Store, Services, Restaurant, E-commerce, Professional, Education, Delivery, Other)",
  "sub.ask_country": "Which country are you in?",
  "sub.ask_city": "Which city are you in?",
  "sub.ask_language": "Which language would you prefer to continue in?\n1️⃣ Spanish\n2️⃣ English\n\nReply 1 or 2.",
  "sub.ask_currency": "Which currency do you want to charge in?\n1️⃣ USD — Dollar\n2️⃣ EUR — Euro\n3️⃣ MXN — Mexican Peso\n4️⃣ COP — Colombian Peso\n5️⃣ PEN — Peruvian Sol\n6️⃣ Other\n\nReply with the number.",
  "sub.ask_plan": "Which plan do you want to subscribe to?\n1️⃣ Quarterly Plan — $25\n2️⃣ Annual Plan — $89\n\nReply 1 or 2.",
  "sub.ask_provider": "Which payment provider do you prefer?\n1️⃣ PayPhone\n2️⃣ DEUNA\n3️⃣ Stripe\n4️⃣ Other\n5️⃣ I don't have one yet\n\nReply 1, 2, 3, 4 or 5.",
  "sub.ask_payphone_business": "Do you have PayPhone Business?\n1️⃣ Yes\n2️⃣ No\n3️⃣ In process\n\nReply 1, 2 or 3.",
  "sub.ask_whatsapp_business": "Do you have WhatsApp Business?\n1️⃣ Yes\n2️⃣ No\n3️⃣ In process\n\nReply 1, 2 or 3.",
  "sub.ask_what_to_charge": "What do you want to charge for via WhatsApp?\n1️⃣ Orders\n2️⃣ Appointments\n3️⃣ Services\n4️⃣ Products\n5️⃣ Tuition\n6️⃣ Reservations\n7️⃣ Invoices\n\nReply with the number.",
  "sub.ask_monthly_payments": "Approximately how many payments do you receive per month? (e.g. 50, 100, 500)",
  "sub.ask_avg_amount": "What is the average amount per payment? (e.g. 25, 50, 100)",
  "sub.confirmation_received": "Thank you! 🎉 We've received your request. Our team will review your details and activate your WhatsApp payment channel as soon as possible. With PayFlow 24H Activation, you don't have to configure anything — we do it for you.",
  "sub.invalid": "I didn't understand your reply. Could you repeat it?",
  "sub.invalid_email": "That email doesn't look valid.",
  "sub.invalid_phone": "That number doesn't look valid.",
  "sub.confirm_question": "Do you confirm you want to submit the request? Reply 'yes' or 'no'.",
  "sub.cancelled": "No problem. If you want to send the request later, just write to us again.",

  "summary.title": "Here are the details we received:",
  "summary.name": "Name",
  "summary.document": "ID",
  "summary.email": "Email",
  "summary.phone": "Mobile",
  "summary.business": "Business",
  "summary.type": "Type",
  "summary.location": "Country",
  "summary.plan": "Plan",
  "summary.provider": "Provider",
  "summary.payphone": "PayPhone Business",
  "summary.whatsapp": "WhatsApp Business",
  "summary.what_charge": "Charges for",
  "summary.monthly": "Payments/month",
  "summary.avg_amount": "Average amount",
  "summary.currency": "Currency",
  "summary.language": "Language",
  "summary.score": "Activation score",
  "summary.template": "Recommended template",
  "summary.confirm": "Do you confirm you want to submit the request? Reply 'yes' or 'no'.",

  "common.yes": "Yes",
  "common.no": "No",
  "common.in_progress": "In process",

  // Readiness recommendations (subscription agent)
  "readiness.fully_ready": "The client is fully ready to activate the payment channel.",
  "readiness.ready_to_activate": "The client is ready for review and possible activation of the payment channel.",
  "readiness.needs_payphone": "The client doesn't have PayPhone Business yet. It can be activated in Mock mode or remain pending configuration.",
  "readiness.needs_whatsapp": "The client doesn't have WhatsApp Business yet. Confirm whether an existing number will be used or if assistance is required.",
  "readiness.incomplete": "Mandatory data is missing to continue with the review.",
  "readiness.needs_more": "Additional review is needed before activation.",
};

const STRINGS: Record<Language, StringMap> = { es: ES, en: EN };

export function t(key: string, lang: Language = "es"): string {
  const map = STRINGS[lang] || STRINGS.es;
  return map[key] ?? STRINGS.es[key] ?? key;
}

// Translate with {{variable}} interpolation.
export function tf(key: string, lang: Language = "es", vars?: Record<string, string | number>): string {
  let s = t(key, lang);
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), String(v));
    }
  }
  return s;
}

export function getLanguageFromLocaleCode(locale?: string | null): Language {
  if (!locale) return "es";
  if (locale.startsWith("en")) return "en";
  return "es";
}
