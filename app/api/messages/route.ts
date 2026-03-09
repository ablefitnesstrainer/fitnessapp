import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const peerId = searchParams.get("peer_id");
  if (!peerId) return NextResponse.json({ error: "peer_id is required" }, { status: 400 });

  const { data: messages, error } = await supabase
    .from("messages")
    .select("*")
    .or(`and(sender_id.eq.${user.id},receiver_id.eq.${peerId}),and(sender_id.eq.${peerId},receiver_id.eq.${user.id})`)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ messages });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    receiver_id: string;
    message: string;
    attachment_url?: string | null;
    attachment_name?: string | null;
    attachment_type?: string | null;
    attachment_size?: number | null;
    attachment_path?: string | null;
  };

  if (!body.receiver_id) return NextResponse.json({ error: "receiver_id is required" }, { status: 400 });
  if (!body.message?.trim() && !body.attachment_url) {
    return NextResponse.json({ error: "Message text or attachment is required" }, { status: 400 });
  }

  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      sender_id: user.id,
      receiver_id: body.receiver_id,
      message: body.message?.trim() || "Attachment",
      attachment_url: body.attachment_url || null,
      attachment_name: body.attachment_name || null,
      attachment_type: body.attachment_type || null,
      attachment_size: body.attachment_size || null,
      attachment_path: body.attachment_path || null
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ message });
}
