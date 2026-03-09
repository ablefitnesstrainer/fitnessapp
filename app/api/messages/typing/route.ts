import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

const isMissingTypingTable = (code?: string) => code === "42P01" || code === "PGRST205";

export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const peerId = searchParams.get("peer_id");
  if (!peerId) return NextResponse.json({ error: "peer_id is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("message_typing_status")
    .select("typed_at")
    .eq("sender_id", peerId)
    .eq("receiver_id", user.id)
    .maybeSingle();

  if (error && isMissingTypingTable(error.code)) return NextResponse.json({ typing: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const typing = Boolean(data?.typed_at) && Date.now() - new Date(data?.typed_at as string).getTime() < 8000;
  return NextResponse.json({ typing });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { receiver_id: string; is_typing: boolean };
  if (!body.receiver_id) return NextResponse.json({ error: "receiver_id is required" }, { status: 400 });

  if (!body.is_typing) {
    const { error } = await supabase.from("message_typing_status").delete().eq("sender_id", user.id).eq("receiver_id", body.receiver_id);
    if (error && isMissingTypingTable(error.code)) return NextResponse.json({ ok: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase.from("message_typing_status").upsert(
    {
      sender_id: user.id,
      receiver_id: body.receiver_id,
      typed_at: new Date().toISOString()
    },
    { onConflict: "sender_id,receiver_id" }
  );

  if (error && isMissingTypingTable(error.code)) return NextResponse.json({ ok: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
