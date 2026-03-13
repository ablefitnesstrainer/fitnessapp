import type { SupabaseClient } from "@supabase/supabase-js";

export type LegalDocumentType =
  | "privacy_policy"
  | "terms_of_service"
  | "liability_ack"
  | "challenge_participation"
  | "contract_disclosure";

type Input = {
  supabase: SupabaseClient;
  actorUserId: string;
  documentType: LegalDocumentType;
  documentVersion: string;
  source?: string | null;
  appUserId?: string | null;
  clientId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function recordLegalAcceptance(input: Input) {
  const { error } = await input.supabase.from("legal_acceptances").insert({
    actor_user_id: input.actorUserId,
    app_user_id: input.appUserId || null,
    client_id: input.clientId || null,
    document_type: input.documentType,
    document_version: input.documentVersion,
    source: input.source || null,
    metadata: input.metadata || {},
    accepted_at: new Date().toISOString()
  });

  if (error) throw error;
}

