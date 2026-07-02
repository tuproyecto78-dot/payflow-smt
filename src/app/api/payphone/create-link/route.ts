import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import {
  getPayPhoneConfig,
  createPayPhoneLink,
  generateClientTransactionId,
  payphoneLinkWhatsAppMessage,
  type PayPhoneLinkRequest,
} from "@/lib/payphone-link";
import { rateLimit, getClientIP, isValidAmount, RATE_LIMIT_ERROR, GENERIC_ERROR } from "@/lib/security";
import { logAudit } from "@/lib/audit";
import { classifyPayPhoneError, savePaymentError } from "@/lib/payphone-errors";

export const dynamic = "force-dynamic";

/**
 * POST /api/payphone/create-link
 *
 * Creates a PayPhone payment link using the admin's own Business account.
 * Admin-only. All token handling is backend-only.
 *
 * Body:
 *   amount: number (dollars)
 *   currency: string (default "USD")
 *   reference: string
 *   clientId?: string
 *   workflowId?: string
 *   workflowRunId?: string
 *   amountWithoutTax?: number
 *   amountWithTax?: number
 *   tax?: number
 *   service?: number
 *   tip?: number
 *   oneTime?: boolean (default true)
 *   isAmountEditable?: boolean (default false)
 *   expireIn?: number (hours, default 24)
 *   language?: "es" | "en"
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIP(req);
  if (!rateLimit(`payphone:create-link:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: RATE_LIMIT_ERROR }, { status: 429 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const {
      amount,
      currency = "USD",
      reference,
      clientId,
      workflowId,
      workflowRunId,
      amountWithoutTax,
      amountWithTax,
      tax,
      service,
      tip,
      oneTime = true,
      isAmountEditable = false,
      expireIn = 24,
      language = "es",
    } = body;

    // Validate amount
    if (!isValidAmount(amount)) {
      void logAudit({
        userId: session.userId,
        action: "validation_error",
        entityType: "payment",
        ipAddress: ip,
        metadata: { reason: "invalid_amount", provider: "PayPhone" },
      });
      return NextResponse.json({ error: "El monto debe ser mayor a 0." }, { status: 400 });
    }

    if (currency.toUpperCase() !== "USD") {
      return NextResponse.json({ error: "PayPhone solo soporta USD." }, { status: 400 });
    }

    if (!reference || typeof reference !== "string") {
      return NextResponse.json({ error: "La referencia es obligatoria." }, { status: 400 });
    }

    // Check PayPhone config
    const config = getPayPhoneConfig();
    if (!config.configured) {
      return NextResponse.json({
        error: `PayPhone no configurado. Faltan: ${config.missingVars.join(", ")}`,
      }, { status: 503 });
    }

    if (!config.apiLinkEnabled) {
      return NextResponse.json({ error: "API Link está desactivado." }, { status: 503 });
    }

    // Generate unique clientTransactionId
    const clientTransactionId = generateClientTransactionId();

    // Create the payment link
    const linkReq: PayPhoneLinkRequest = {
      amount,
      currency: "USD",
      reference: String(reference).slice(0, 100),
      clientTransactionId,
      storeId: config.storeId,
      amountWithoutTax,
      amountWithTax,
      tax,
      service,
      tip,
      oneTime: Boolean(oneTime),
      isAmountEditable: Boolean(isAmountEditable),
      expireIn: typeof expireIn === "number" ? expireIn : 24,
      language: language === "en" ? "en" : "es",
    };

    const result = await createPayPhoneLink(linkReq);

    // Build the raw request for storage (sanitized — no token)
    const rawRequest: Record<string, unknown> = {
      amount: Math.round(amount * 100),
      amountWithoutTax: linkReq.amountWithoutTax !== undefined ? Math.round(linkReq.amountWithoutTax * 100) : Math.round(amount * 100),
      amountWithTax: linkReq.amountWithTax ? Math.round(linkReq.amountWithTax * 100) : 0,
      tax: linkReq.tax ? Math.round(linkReq.tax * 100) : 0,
      service: linkReq.service ? Math.round(linkReq.service * 100) : 0,
      tip: linkReq.tip ? Math.round(linkReq.tip * 100) : 0,
      currency: "USD",
      clientTransactionId,
      storeId: config.storeId,
      reference: linkReq.reference,
      oneTime: linkReq.oneTime,
      isAmountEditable: linkReq.isAmountEditable,
      expireIn: linkReq.expireIn,
      language: linkReq.language,
      // NOTE: token is intentionally NOT included
    };

    // Save the transaction
    const tx = await db.paymentTransaction.create({
      data: {
        userId: session.userId,
        clientId: clientId || null,
        workflowId: workflowId || null,
        workflowRunId: workflowRunId || null,
        provider: "PayPhone",
        integrationType: "API_LINK",
        credentialMode: "GLOBAL_ADMIN_ACCOUNT",
        clientTransactionId,
        storeId: config.storeId,
        orderId: clientTransactionId,
        amount,
        amountWithoutTax: linkReq.amountWithoutTax ?? amount,
        amountWithTax: linkReq.amountWithTax ?? 0,
        tax: linkReq.tax ?? 0,
        service: linkReq.service ?? 0,
        tip: linkReq.tip ?? 0,
        currency: "USD",
        reference: linkReq.reference,
        paymentLink: result.payment_link || null,
        status: result.ok ? "payment_pending" : "error",
        rawRequest: JSON.stringify(rawRequest),
        rawResponse: JSON.stringify(result.raw_response),
      },
    });

    // Audit log (no tokens in metadata)
    void logAudit({
      userId: session.userId,
      action: "payment_created",
      entityType: "payment",
      entityId: tx.id,
      ipAddress: ip,
      metadata: {
        provider: "PayPhone",
        integration_type: "API_LINK",
        credential_mode: "GLOBAL_ADMIN_ACCOUNT",
        env: config.env,
        amount,
        currency: "USD",
        reference: linkReq.reference,
        client_transaction_id: clientTransactionId,
        store_id: config.storeId,
        link_created: result.ok,
      },
    });

    if (!result.ok) {
      // Classify and save the error using the PayPhone Error Handler
      const httpStatus = (result.raw_response as { httpStatus?: number }).httpStatus;
      const providerMsg = (result.raw_response as { message?: string }).message || result.error || "";
      const errorInput = {
        paymentTransactionId: tx.id,
        statusCode: httpStatus,
        providerMessage: providerMsg,
        rawError: result.raw_response as Record<string, unknown>,
        error: result.error,
      };
      const errorResult = classifyPayPhoneError(errorInput);
      void savePaymentError(errorInput, errorResult);

      // Safe log (no tokens)
      console.error("[payphone/create-link] PayPhone API error:", {
        env: config.env,
        store_id: config.storeId,
        token_configured: !!config.token,
        error_type: errorResult.errorType,
        error_code: errorResult.errorCode,
        status_code: errorResult.statusCode,
        admin_message: errorResult.adminMessage,
      });

      // Return admin message (this is an admin-only endpoint) + user message for WhatsApp
      return NextResponse.json({
        ok: false,
        error: errorResult.adminMessage,
        user_message: errorResult.userMessage,
        error_type: errorResult.errorType,
        error_code: errorResult.errorCode,
        retryable: errorResult.retryable,
        payment_id: tx.id,
        client_transaction_id: clientTransactionId,
      }, { status: 502 });
    }

    // Build WhatsApp message
    const whatsappMessage = payphoneLinkWhatsAppMessage(
      amount,
      "USD",
      linkReq.reference,
      result.payment_link,
      language === "en" ? "en" : "es"
    );

    return NextResponse.json({
      ok: true,
      payment_id: tx.id,
      client_transaction_id: clientTransactionId,
      store_id: config.storeId,
      integration_type: "API_LINK",
      credential_mode: "GLOBAL_ADMIN_ACCOUNT",
      env: config.env,
      amount,
      currency: "USD",
      reference: linkReq.reference,
      payment_link: result.payment_link,
      payment_status: "payment_pending",
      whatsapp_message: whatsappMessage,
      raw_response: result.raw_response,
    });
  } catch (err) {
    console.error("[payphone/create-link] error:", err);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}
