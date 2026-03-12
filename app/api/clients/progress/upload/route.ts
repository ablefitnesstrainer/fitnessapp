import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { enforceRateLimit } from "@/lib/security-controls";
import { validateUploadedBuffer } from "@/lib/file-security";

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
    return { clientId: client.id, userId: user.id };
  }

  if (!requestedClientId) return { error: NextResponse.json({ error: "client_id is required" }, { status: 400 }) };
  if (appUser.role === "admin") return { clientId: requestedClientId, userId: user.id };

  const { data: managedClient, error: managedClientError } = await supabase
    .from("clients")
    .select("id")
    .eq("id", requestedClientId)
    .eq("coach_id", user.id)
    .maybeSingle();
  if (managedClientError || !managedClient) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { clientId: requestedClientId, userId: user.id };
}

function extensionForMime(mime: string) {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return null;
}

export async function POST(request: Request) {
  const supabase = createClient();
  const formData = await request.formData();
  const clientId = String(formData.get("client_id") || "");
  const caption = String(formData.get("caption") || "");
  const takenAt = String(formData.get("taken_at") || new Date().toISOString().slice(0, 10));
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Photo file is required" }, { status: 400 });
  }

  const auth = await authorizeClientAccess(supabase, clientId || null);
  if ("error" in auth) return auth.error;

  const limited = await enforceRateLimit({
    scope: "clients.progress.upload",
    identifier: auth.userId,
    limit: 30,
    windowSeconds: 60 * 60
  });
  if (limited) return limited;

  const ext = extensionForMime(file.type);
  if (!ext) return NextResponse.json({ error: "Only JPG, PNG, and WEBP are supported" }, { status: 400 });

  const maxBytes = 10 * 1024 * 1024;
  if (file.size > maxBytes) return NextResponse.json({ error: "Photo must be 10MB or smaller" }, { status: 400 });

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const validation = validateUploadedBuffer(file.type, buffer);
  if (!validation.ok) return NextResponse.json({ error: validation.reason }, { status: 400 });

  const now = Date.now();
  const storagePath = `${auth.clientId}/${now}-${Math.random().toString(36).slice(2)}.${ext}`;

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage.from("progress-photos").upload(storagePath, buffer, {
    contentType: file.type,
    upsert: false
  });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });
  const { data: signedUrlData, error: signedUrlError } = await admin.storage.from("progress-photos").createSignedUrl(storagePath, 60 * 60);
  if (signedUrlError) {
    await admin.storage.from("progress-photos").remove([storagePath]);
    return NextResponse.json({ error: signedUrlError.message }, { status: 400 });
  }
  const photoUrl = signedUrlData.signedUrl;

  const { data: photo, error: insertError } = await supabase
    .from("progress_photos")
    .insert({
      client_id: auth.clientId,
      photo_url: null,
      storage_path: storagePath,
      caption: caption || null,
      taken_at: takenAt || new Date().toISOString().slice(0, 10),
      uploaded_by: auth.userId
    })
    .select("id,photo_url,caption,taken_at,created_at")
    .single();

  if (insertError) {
    await admin.storage.from("progress-photos").remove([storagePath]);
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  return NextResponse.json({ photo });
}
