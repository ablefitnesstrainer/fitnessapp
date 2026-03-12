import { NextResponse } from "next/server";
import { authorizeCommunityAccess } from "../../../_auth";
import { enforceRateLimit } from "@/lib/security-controls";
import { writeAuditLog } from "@/lib/audit-log";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await authorizeCommunityAccess();
  if ("error" in auth) return auth.error;
  const { supabase, userId, clientId } = auth.context;

  const limited = await enforceRateLimit({
    scope: "community.comments.create",
    identifier: userId,
    limit: 120,
    windowSeconds: 60 * 60
  });
  if (limited) return limited;

  if (!params.id) return NextResponse.json({ error: "Post id is required" }, { status: 400 });

  const { data: post, error: postError } = await supabase
    .from("community_posts")
    .select("id,is_hidden")
    .eq("id", params.id)
    .maybeSingle();

  if (postError) return NextResponse.json({ error: postError.message }, { status: 400 });
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  if (post.is_hidden && auth.context.role === "client") {
    return NextResponse.json({ error: "Cannot comment on hidden post" }, { status: 403 });
  }

  const body = (await request.json()) as { body: string; parent_comment_id?: string | null };
  const text = body.body?.trim() || "";
  if (text.length < 2) return NextResponse.json({ error: "Comment must be at least 2 characters" }, { status: 400 });
  if (text.length > 1000) return NextResponse.json({ error: "Comment must be 1000 characters or less" }, { status: 400 });

  const { data: comment, error } = await supabase
    .from("community_comments")
    .insert({
      post_id: params.id,
      parent_comment_id: body.parent_comment_id || null,
      author_user_id: userId,
      author_client_id: clientId,
      body: text,
      is_hidden: false
    })
    .select("id,post_id,parent_comment_id,body,created_at,author_user_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog({
    supabase,
    request,
    actorId: userId,
    action: "community.comment.create",
    entityType: "community_comment",
    entityId: comment.id,
    metadata: { post_id: params.id }
  });

  return NextResponse.json({ comment });
}
