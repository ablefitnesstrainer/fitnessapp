import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

const isMissingReadField = (code?: string) => code === "42703" || code === "PGRST204";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("messages")
    .select("sender_id")
    .eq("receiver_id", user.id)
    .is("read_at", null);

  if (error && !isMissingReadField(error.code)) return NextResponse.json({ error: error.message }, { status: 400 });
  if (error && isMissingReadField(error.code)) return NextResponse.json({ byPeer: {}, totalUnread: 0 });

  const byPeer: Record<string, number> = {};
  for (const row of data || []) {
    byPeer[row.sender_id] = (byPeer[row.sender_id] || 0) + 1;
  }

  const totalUnread = Object.values(byPeer).reduce((sum, count) => sum + count, 0);
  return NextResponse.json({ byPeer, totalUnread });
}
