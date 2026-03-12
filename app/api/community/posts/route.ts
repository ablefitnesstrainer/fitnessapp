import { NextResponse } from "next/server";
import { authorizeCommunityAccess } from "../_auth";
import { enforceRateLimit } from "@/lib/security-controls";
import { writeAuditLog } from "@/lib/audit-log";

type PostRow = {
  id: string;
  author_user_id: string;
  author_client_id: string | null;
  body: string;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
};

type CommentRow = {
  id: string;
  post_id: string;
  parent_comment_id: string | null;
  author_user_id: string;
  author_client_id: string | null;
  body: string;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
};

function publicName(fullName: string | null | undefined, userId: string) {
  if (fullName?.trim()) return fullName.trim();
  return `Member ${userId.slice(0, 6)}`;
}

export async function GET(request: Request) {
  const auth = await authorizeCommunityAccess();
  if ("error" in auth) return auth.error;
  const { supabase, role } = auth.context;

  const search = new URL(request.url).searchParams;
  const cursor = Math.max(0, Number(search.get("cursor") || 0));
  const limit = Math.min(40, Math.max(10, Number(search.get("limit") || 20)));

  let postsQuery = supabase
    .from("community_posts")
    .select("id,author_user_id,author_client_id,body,is_hidden,created_at,updated_at")
    .order("created_at", { ascending: false })
    .range(cursor, cursor + limit - 1);

  if (role === "client") {
    postsQuery = postsQuery.eq("is_hidden", false);
  }

  const { data: postsData, error: postsError } = await postsQuery;
  if (postsError) return NextResponse.json({ error: postsError.message }, { status: 400 });

  const posts = (postsData || []) as PostRow[];
  const postIds = posts.map((post) => post.id);

  let commentsData: CommentRow[] = [];
  if (postIds.length > 0) {
    let commentsQuery = supabase
      .from("community_comments")
      .select("id,post_id,parent_comment_id,author_user_id,author_client_id,body,is_hidden,created_at,updated_at")
      .in("post_id", postIds)
      .order("created_at", { ascending: true });

    if (role === "client") {
      commentsQuery = commentsQuery.eq("is_hidden", false);
    }

    const { data, error } = await commentsQuery;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    commentsData = (data || []) as CommentRow[];
  }

  const authorIds = Array.from(
    new Set(
      [...posts.map((post) => post.author_user_id), ...commentsData.map((comment) => comment.author_user_id)].filter(Boolean)
    )
  );

  const { data: usersData, error: usersError } = authorIds.length
    ? await supabase.from("app_users").select("id,full_name").in("id", authorIds)
    : { data: [], error: null };
  if (usersError) return NextResponse.json({ error: usersError.message }, { status: 400 });

  const nameByUserId = new Map((usersData || []).map((user) => [user.id, publicName(user.full_name, user.id)]));

  const commentsByPost = new Map<string, Array<Record<string, unknown>>>();
  for (const comment of commentsData) {
    const current = commentsByPost.get(comment.post_id) || [];
    current.push({
      id: comment.id,
      post_id: comment.post_id,
      parent_comment_id: comment.parent_comment_id,
      body: comment.body,
      is_hidden: comment.is_hidden,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      author_user_id: comment.author_user_id,
      author_name: nameByUserId.get(comment.author_user_id) || publicName(null, comment.author_user_id),
      can_edit: auth.context.userId === comment.author_user_id || role === "admin" || role === "coach"
    });
    commentsByPost.set(comment.post_id, current);
  }

  const responsePosts = posts.map((post) => ({
    id: post.id,
    body: post.body,
    is_hidden: post.is_hidden,
    created_at: post.created_at,
    updated_at: post.updated_at,
    author_user_id: post.author_user_id,
    author_name: nameByUserId.get(post.author_user_id) || publicName(null, post.author_user_id),
    can_edit: auth.context.userId === post.author_user_id || role === "admin" || role === "coach",
    comments: commentsByPost.get(post.id) || []
  }));

  return NextResponse.json({
    posts: responsePosts,
    next_cursor: posts.length < limit ? null : cursor + posts.length
  });
}

export async function POST(request: Request) {
  const auth = await authorizeCommunityAccess();
  if ("error" in auth) return auth.error;
  const { supabase, userId, clientId } = auth.context;

  const limited = await enforceRateLimit({
    scope: "community.posts.create",
    identifier: userId,
    limit: 30,
    windowSeconds: 60 * 60
  });
  if (limited) return limited;

  const body = (await request.json()) as { body: string };
  const text = body.body?.trim() || "";
  if (text.length < 3) return NextResponse.json({ error: "Post must be at least 3 characters" }, { status: 400 });
  if (text.length > 1200) return NextResponse.json({ error: "Post must be 1200 characters or less" }, { status: 400 });

  const { data: post, error } = await supabase
    .from("community_posts")
    .insert({
      author_user_id: userId,
      author_client_id: clientId,
      body: text,
      is_hidden: false
    })
    .select("id,body,created_at,author_user_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog({
    supabase,
    request,
    actorId: userId,
    action: "community.post.create",
    entityType: "community_post",
    entityId: post.id
  });

  return NextResponse.json({
    post: {
      ...post,
      author_name: publicName(null, post.author_user_id)
    }
  });
}
