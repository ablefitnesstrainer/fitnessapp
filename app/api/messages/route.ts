import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { enforceRateLimit } from "@/lib/security-controls";

const isMissingReadField = (code?: string) => code === "42703" || code === "PGRST204";

export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const peerId = searchParams.get("peer_id");
  if (!peerId) return NextResponse.json({ error: "peer_id is required" }, { status: 400 });

  const { error: readError } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("sender_id", peerId)
    .eq("receiver_id", user.id)
    .is("read_at", null);
  if (readError && !isMissingReadField(readError.code)) {
    return NextResponse.json({ error: readError.message }, { status: 400 });
  }

  const { data: messages, error } = await supabase
    .from("messages")
    .select("*")
    .or(`and(sender_id.eq.${user.id},receiver_id.eq.${peerId}),and(sender_id.eq.${peerId},receiver_id.eq.${user.id})`)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const list = messages || [];
  const paths = list.map((message) => message.attachment_path).filter((path): path is string => Boolean(path));
  const signedByPath = new Map<string, string>();
  if (paths.length > 0) {
    try {
      const admin = createAdminClient();
      const signed = await admin.storage.from("message-attachments").createSignedUrls(paths, 60 * 60);
      if (!signed.error && Array.isArray(signed.data)) {
        signed.data.forEach((item, index) => {
          if (!item.error && item.signedUrl) signedByPath.set(paths[index], item.signedUrl);
        });
      }
    } catch {
      // If admin client is unavailable, fall back to persisted URLs when present.
    }
  }

  const normalized = list.map((message) => ({
    ...message,
    attachment_url: message.attachment_path ? signedByPath.get(message.attachment_path) || null : message.attachment_url || null
  }));

  return NextResponse.json({ messages: normalized });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await enforceRateLimit({
    scope: "messages.send",
    identifier: user.id,
    limit: 120,
    windowSeconds: 60
  });
  if (limited) return limited;

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
  if (!body.message?.trim() && !body.attachment_url && !body.attachment_path) {
    return NextResponse.json({ error: "Message text or attachment is required" }, { status: 400 });
  }
  if (body.message && body.message.length > 4000) {
    return NextResponse.json({ error: "Message must be 4000 characters or less" }, { status: 400 });
  }
  if (body.attachment_path && !body.attachment_path.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "Invalid attachment path" }, { status: 400 });
  }
  if (body.attachment_size && Number(body.attachment_size) > 15 * 1024 * 1024) {
    return NextResponse.json({ error: "Attachment exceeds allowed size" }, { status: 400 });
  }

  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      sender_id: user.id,
      receiver_id: body.receiver_id,
      message: body.message?.trim() || "Attachment",
      read_at: null,
      attachment_url: null,
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
