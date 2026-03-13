import { NextResponse } from "next/server";
import { authorizeChallengeAccess } from "../../_auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { enforceRateLimit } from "@/lib/security-controls";
import { validateUploadedBuffer } from "@/lib/file-security";

function extensionForMime(mime: string) {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return null;
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await authorizeChallengeAccess({ requireCoachOrAdmin: true });
  if ("error" in auth) return auth.error;
  const { supabase, role, userId } = auth.context;

  const challengeId = params.id;
  if (!challengeId) return NextResponse.json({ error: "Challenge id is required" }, { status: 400 });

  const { data: challenge, error: challengeError } = await supabase
    .from("challenges")
    .select("id,created_by,logo_storage_path")
    .eq("id", challengeId)
    .maybeSingle();
  if (challengeError) return NextResponse.json({ error: challengeError.message }, { status: 400 });
  if (!challenge) return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  if (role === "coach" && challenge.created_by !== userId) {
    return NextResponse.json({ error: "Coach can only edit own challenges" }, { status: 403 });
  }

  const limited = await enforceRateLimit({
    scope: "challenges.logo.upload",
    identifier: userId,
    limit: 30,
    windowSeconds: 60 * 60
  });
  if (limited) return limited;

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Logo file is required" }, { status: 400 });
  }

  const ext = extensionForMime(file.type);
  if (!ext) return NextResponse.json({ error: "Only JPG, PNG, and WEBP are supported" }, { status: 400 });

  const maxBytes = 5 * 1024 * 1024;
  if (file.size > maxBytes) return NextResponse.json({ error: "Logo must be 5MB or smaller" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const validation = validateUploadedBuffer(file.type, buffer);
  if (!validation.ok) return NextResponse.json({ error: validation.reason }, { status: 400 });

  const admin = createAdminClient();
  const storagePath = `${challengeId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error: uploadError } = await admin.storage.from("challenge-logos").upload(storagePath, buffer, {
    contentType: file.type,
    upsert: false
  });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });

  const { error: updateError } = await supabase.from("challenges").update({ logo_storage_path: storagePath }).eq("id", challengeId);
  if (updateError) {
    await admin.storage.from("challenge-logos").remove([storagePath]);
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  if (challenge.logo_storage_path && challenge.logo_storage_path !== storagePath) {
    await admin.storage.from("challenge-logos").remove([challenge.logo_storage_path]);
  }

  const { data: signed, error: signedError } = await admin.storage.from("challenge-logos").createSignedUrl(storagePath, 60 * 60);
  if (signedError) return NextResponse.json({ error: signedError.message }, { status: 400 });

  return NextResponse.json({ ok: true, logo_url: signed.signedUrl, storage_path: storagePath });
}

