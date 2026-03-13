import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { enforceRateLimit } from "@/lib/security-controls";
import { validateUploadedBuffer } from "@/lib/file-security";

function extensionForMime(mime: string) {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return null;
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await enforceRateLimit({
    scope: "profile.photo.upload",
    identifier: user.id,
    limit: 20,
    windowSeconds: 60 * 60
  });
  if (limited) return limited;

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Photo file is required" }, { status: 400 });
  }

  const ext = extensionForMime(file.type);
  if (!ext) return NextResponse.json({ error: "Only JPG, PNG, and WEBP are supported" }, { status: 400 });

  const maxBytes = 5 * 1024 * 1024;
  if (file.size > maxBytes) return NextResponse.json({ error: "Photo must be 5MB or smaller" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const validation = validateUploadedBuffer(file.type, buffer);
  if (!validation.ok) return NextResponse.json({ error: validation.reason }, { status: 400 });

  const admin = createAdminClient();
  const { data: currentRow } = await admin.from("app_users").select("profile_photo_path").eq("id", user.id).maybeSingle();
  const previousPath = currentRow?.profile_photo_path || null;

  const storagePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error: uploadError } = await admin.storage.from("profile-photos").upload(storagePath, buffer, {
    contentType: file.type,
    upsert: false
  });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });

  const { error: updateError } = await admin.from("app_users").update({ profile_photo_path: storagePath }).eq("id", user.id);
  if (updateError) {
    await admin.storage.from("profile-photos").remove([storagePath]);
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  if (previousPath && previousPath !== storagePath) {
    await admin.storage.from("profile-photos").remove([previousPath]);
  }

  const { data: signedData, error: signedError } = await admin.storage.from("profile-photos").createSignedUrl(storagePath, 60 * 60);
  if (signedError) return NextResponse.json({ error: signedError.message }, { status: 400 });

  return NextResponse.json({ ok: true, photo_url: signedData.signedUrl, storage_path: storagePath });
}

