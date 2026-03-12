import { NextResponse } from "next/server";
import { authorizeCommunityAccess } from "../_auth";
import { writeAuditLog } from "@/lib/audit-log";

type ModeratePayload = {
  target_type: "post" | "comment" | "report";
  target_id: string;
  action: "hide" | "unhide" | "delete" | "resolve";
  reason?: string;
};

export async function GET() {
  const auth = await authorizeCommunityAccess({ requireCoachOrAdmin: true });
  if ("error" in auth) return auth.error;
  const { supabase } = auth.context;

  const [{ data: reports, error: reportsError }, { data: posts, error: postsError }, { data: comments, error: commentsError }] = await Promise.all([
    supabase
      .from("community_reports")
      .select("id,post_id,comment_id,reason,resolved,created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("community_posts")
      .select("id,body,is_hidden,created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("community_comments")
      .select("id,post_id,body,is_hidden,created_at")
      .order("created_at", { ascending: false })
      .limit(200)
  ]);

  if (reportsError) return NextResponse.json({ error: reportsError.message }, { status: 400 });
  if (postsError) return NextResponse.json({ error: postsError.message }, { status: 400 });
  if (commentsError) return NextResponse.json({ error: commentsError.message }, { status: 400 });

  return NextResponse.json({
    reports: reports || [],
    posts: posts || [],
    comments: comments || []
  });
}

export async function PATCH(request: Request) {
  const auth = await authorizeCommunityAccess({ requireCoachOrAdmin: true });
  if ("error" in auth) return auth.error;
  const { supabase, userId } = auth.context;

  const body = (await request.json()) as ModeratePayload;
  if (!body.target_type || !body.target_id || !body.action) {
    return NextResponse.json({ error: "target_type, target_id, and action are required" }, { status: 400 });
  }

  if (body.target_type === "report") {
    if (body.action !== "resolve") {
      return NextResponse.json({ error: "Reports only support resolve action" }, { status: 400 });
    }

    const { error } = await supabase
      .from("community_reports")
      .update({ resolved: true, resolved_by: userId, resolved_at: new Date().toISOString() })
      .eq("id", body.target_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await writeAuditLog({
      supabase,
      request,
      actorId: userId,
      action: "community.report.resolve",
      entityType: "community_report",
      entityId: body.target_id
    });

    return NextResponse.json({ ok: true });
  }

  const table = body.target_type === "post" ? "community_posts" : "community_comments";

  if (body.action === "delete") {
    const { error } = await supabase.from(table).delete().eq("id", body.target_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await writeAuditLog({
      supabase,
      request,
      actorId: userId,
      action: `community.${body.target_type}.delete`,
      entityType: table,
      entityId: body.target_id
    });

    return NextResponse.json({ ok: true });
  }

  const shouldHide = body.action === "hide";
  if (body.action !== "hide" && body.action !== "unhide") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  const { error } = await supabase
    .from(table)
    .update({
      is_hidden: shouldHide,
      hidden_reason: shouldHide ? body.reason?.trim() || "moderated" : null,
      hidden_by: shouldHide ? userId : null
    })
    .eq("id", body.target_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog({
    supabase,
    request,
    actorId: userId,
    action: `community.${body.target_type}.${body.action}`,
    entityType: table,
    entityId: body.target_id,
    metadata: { reason: body.reason?.trim() || null }
  });

  return NextResponse.json({ ok: true });
}
