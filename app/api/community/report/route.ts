import { NextResponse } from "next/server";
import { authorizeCommunityAccess } from "../_auth";
import { enforceRateLimit } from "@/lib/security-controls";
import { writeAuditLog } from "@/lib/audit-log";

export async function POST(request: Request) {
  const auth = await authorizeCommunityAccess();
  if ("error" in auth) return auth.error;
  const { supabase, userId, clientId } = auth.context;

  const limited = await enforceRateLimit({
    scope: "community.reports.create",
    identifier: userId,
    limit: 40,
    windowSeconds: 60 * 60
  });
  if (limited) return limited;

  const body = (await request.json()) as {
    post_id?: string | null;
    comment_id?: string | null;
    reason: string;
  };

  const reason = body.reason?.trim() || "";
  if (!reason || reason.length < 4) {
    return NextResponse.json({ error: "Reason is required" }, { status: 400 });
  }

  if ((!body.post_id && !body.comment_id) || (body.post_id && body.comment_id)) {
    return NextResponse.json({ error: "Provide post_id or comment_id" }, { status: 400 });
  }

  const { data: report, error } = await supabase
    .from("community_reports")
    .insert({
      reporter_user_id: userId,
      reporter_client_id: clientId,
      post_id: body.post_id || null,
      comment_id: body.comment_id || null,
      reason
    })
    .select("id,post_id,comment_id,created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog({
    supabase,
    request,
    actorId: userId,
    action: "community.report.create",
    entityType: "community_report",
    entityId: report.id,
    metadata: {
      post_id: report.post_id,
      comment_id: report.comment_id
    }
  });

  return NextResponse.json({ report });
}
