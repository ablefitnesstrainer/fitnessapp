import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { deriveContractStatus } from "@/lib/breezedoc";
import { createHmac, timingSafeEqual } from "node:crypto";

type AnyRecord = Record<string, unknown>;

function asRecord(value: unknown): AnyRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as AnyRecord;
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function extractDocumentId(payload: unknown): number | null {
  const root = asRecord(payload);
  if (!root) return null;

  const candidates: unknown[] = [
    root.document_id,
    asRecord(root.document)?.id,
    asRecord(root.data)?.document_id,
    asRecord(root.data)?.id,
    asRecord(asRecord(root.data)?.document)?.id
  ];

  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return null;
}

function extractRecipients(payload: unknown) {
  const root = asRecord(payload);
  if (!root) return [];

  const direct = asArray(root.recipients);
  if (direct.length) return direct;

  const documentRecipients = asArray(asRecord(root.document)?.recipients);
  if (documentRecipients.length) return documentRecipients;

  const dataRecipients = asArray(asRecord(root.data)?.recipients);
  if (dataRecipients.length) return dataRecipients;

  const dataDocumentRecipients = asArray(asRecord(asRecord(root.data)?.document)?.recipients);
  if (dataDocumentRecipients.length) return dataDocumentRecipients;

  return [];
}

function extractLatestTimestamp(recipients: unknown[], field: "sent_at" | "opened_at" | "completed_at") {
  const values = recipients
    .map((recipient) => asRecord(recipient)?.[field])
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .sort();
  return values.at(-1) || null;
}

function parseSignature(signatureHeader: string | null) {
  if (!signatureHeader) return null;
  const trimmed = signatureHeader.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("sha256=")) return trimmed.slice("sha256=".length).trim();
  return trimmed;
}

function verifyWebhookSignature(rawBody: string, signatureHeader: string | null, secret: string) {
  const providedSignature = parseSignature(signatureHeader);
  if (!providedSignature) return false;

  const expectedSignature = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const providedBuffer = Buffer.from(providedSignature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

function timestampWithinTolerance(timestampHeader: string | null) {
  if (!timestampHeader) return true;
  const timestampSeconds = Number(timestampHeader);
  if (!Number.isFinite(timestampSeconds)) return true;
  const toleranceSeconds = Number(process.env.BREEZEDOC_WEBHOOK_TOLERANCE_SECONDS || 300);
  const nowSeconds = Math.floor(Date.now() / 1000);
  return Math.abs(nowSeconds - timestampSeconds) <= Math.max(30, Math.floor(toleranceSeconds));
}

export async function POST(request: Request) {
  const webhookSecret = process.env.BREEZEDOC_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret is not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const signatureHeader =
    request.headers.get("x-breezedoc-signature") ||
    request.headers.get("x-signature") ||
    request.headers.get("x-webhook-signature");
  const timestampHeader = request.headers.get("x-breezedoc-timestamp") || request.headers.get("x-webhook-timestamp");

  if (!timestampWithinTolerance(timestampHeader)) {
    return NextResponse.json({ error: "Stale webhook timestamp" }, { status: 401 });
  }

  if (!verifyWebhookSignature(rawBody, signatureHeader, webhookSecret)) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  let payload: unknown = {};
  if (rawBody.trim().length) {
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }
  }

  const documentId = extractDocumentId(payload);
  if (!documentId) return NextResponse.json({ ok: true, ignored: "missing_document_id" });

  const recipients = extractRecipients(payload);
  const root = asRecord(payload);
  const explicitStatus = typeof root?.status === "string" ? root.status : null;
  const status = explicitStatus || deriveContractStatus(recipients as Array<Record<string, unknown>>);
  const sentAt = extractLatestTimestamp(recipients, "sent_at");
  const openedAt = extractLatestTimestamp(recipients, "opened_at");
  const completedAt = extractLatestTimestamp(recipients, "completed_at");

  const admin = createAdminClient();
  const { data: latestContract, error: latestError } = await admin
    .from("client_contracts")
    .select("id,provider_payload,sent_at,opened_at,completed_at")
    .eq("document_id", documentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) return NextResponse.json({ error: latestError.message }, { status: 400 });
  if (!latestContract) return NextResponse.json({ ok: true, ignored: "unknown_document_id" });

  const providerPayload = asRecord(latestContract.provider_payload) || {};
  const nextProviderPayload = {
    ...providerPayload,
    recipients,
    webhook_last_event: payload,
    webhook_received_at: new Date().toISOString()
  };

  const { error: updateError } = await admin
    .from("client_contracts")
    .update({
      status,
      sent_at: sentAt || latestContract.sent_at,
      opened_at: openedAt || latestContract.opened_at,
      completed_at: completedAt || latestContract.completed_at,
      provider_payload: nextProviderPayload,
      updated_at: new Date().toISOString()
    })
    .eq("id", latestContract.id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

