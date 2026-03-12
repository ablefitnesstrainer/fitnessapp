import { NextResponse } from "next/server";
import { authorizeCommunityAccess } from "../../_auth";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await authorizeCommunityAccess();
  if ("error" in auth) return auth.error;
  const { supabase } = auth.context;

  const body = (await request.json()) as { body: string };
  const text = body.body?.trim() || "";
  if (text.length < 2 || text.length > 1000) {
    return NextResponse.json({ error: "Comment must be between 2 and 1000 characters" }, { status: 400 });
  }

  const { error } = await supabase.from("community_comments").update({ body: text }).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const auth = await authorizeCommunityAccess();
  if ("error" in auth) return auth.error;
  const { supabase } = auth.context;

  const { error } = await supabase.from("community_comments").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
