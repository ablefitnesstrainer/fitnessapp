import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

async function authorizeClientAccess(supabase: ReturnType<typeof createClient>, requestedClientId?: string | null) {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { data: appUser, error: appUserError } = await supabase.from("app_users").select("id,role").eq("id", user.id).single();
  if (appUserError || !appUser) return { error: NextResponse.json({ error: appUserError?.message || "Unauthorized" }, { status: 401 }) };

  if (appUser.role === "client") {
    const { data: client, error: clientError } = await supabase.from("clients").select("id").eq("user_id", user.id).maybeSingle();
    if (clientError || !client) return { error: NextResponse.json({ error: clientError?.message || "Client not found" }, { status: 404 }) };
    if (requestedClientId && requestedClientId !== client.id) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    return { clientId: client.id, userId: user.id, role: appUser.role as "admin" | "coach" | "client" };
  }

  if (!requestedClientId) return { error: NextResponse.json({ error: "client_id is required" }, { status: 400 }) };
  if (appUser.role === "admin") return { clientId: requestedClientId, userId: user.id, role: appUser.role as "admin" | "coach" | "client" };

  const { data: managedClient, error: managedClientError } = await supabase
    .from("clients")
    .select("id")
    .eq("id", requestedClientId)
    .eq("coach_id", user.id)
    .maybeSingle();
  if (managedClientError || !managedClient) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { clientId: requestedClientId, userId: user.id, role: appUser.role as "admin" | "coach" | "client" };
}

export async function GET(request: Request) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  const auth = await authorizeClientAccess(supabase, searchParams.get("client_id"));
  if ("error" in auth) return auth.error;

  const [{ data: photos, error: photosError }, { data: notes, error: notesError }] = await Promise.all([
    supabase.from("progress_photos").select("id,photo_url,caption,taken_at,created_at").eq("client_id", auth.clientId).order("taken_at", { ascending: false }).limit(40),
    supabase.from("coach_notes").select("id,note,created_at").eq("client_id", auth.clientId).order("created_at", { ascending: false }).limit(40)
  ]);

  if (photosError) return NextResponse.json({ error: photosError.message }, { status: 400 });
  if (notesError) return NextResponse.json({ error: notesError.message }, { status: 400 });

  return NextResponse.json({ photos: photos || [], notes: notes || [] });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const body = (await request.json()) as {
    client_id: string;
    type: "photo" | "note";
    photo_url?: string;
    caption?: string;
    taken_at?: string;
    note?: string;
  };

  const auth = await authorizeClientAccess(supabase, body.client_id);
  if ("error" in auth) return auth.error;

  if (body.type === "photo") {
    if (auth.role === "client") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!body.photo_url?.trim()) return NextResponse.json({ error: "photo_url is required" }, { status: 400 });

    const { data: photo, error } = await supabase
      .from("progress_photos")
      .insert({
        client_id: auth.clientId,
        photo_url: body.photo_url.trim(),
        caption: body.caption?.trim() || null,
        taken_at: body.taken_at || new Date().toISOString().slice(0, 10),
        uploaded_by: auth.userId
      })
      .select("id,photo_url,caption,taken_at,created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ photo });
  }

  if (!body.note?.trim()) return NextResponse.json({ error: "note is required" }, { status: 400 });

  const { data: note, error } = await supabase
    .from("coach_notes")
    .insert({
      client_id: auth.clientId,
      note: body.note.trim(),
      created_by: auth.userId
    })
    .select("id,note,created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ note });
}

export async function DELETE(request: Request) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const id = searchParams.get("id");
  const clientId = searchParams.get("client_id");
  if (!type || !id) return NextResponse.json({ error: "type and id are required" }, { status: 400 });

  const auth = await authorizeClientAccess(supabase, clientId);
  if ("error" in auth) return auth.error;
  if (auth.role === "client") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const table = type === "photo" ? "progress_photos" : type === "note" ? "coach_notes" : null;
  if (!table) return NextResponse.json({ error: "Invalid type" }, { status: 400 });

  const { error } = await supabase.from(table).delete().eq("id", id).eq("client_id", auth.clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
