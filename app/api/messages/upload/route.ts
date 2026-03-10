import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

function allowedMime(mime: string) {
  return ["image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain"].includes(mime);
}

function extensionForMime(mime: string) {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "application/pdf") return "pdf";
  if (mime === "text/plain") return "txt";
  return null;
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file is required" }, { status: 400 });

  if (!allowedMime(file.type)) return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: "File must be 15MB or smaller" }, { status: 400 });

  const ext = extensionForMime(file.type);
  if (!ext) return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const storagePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage.from("message-attachments").upload(storagePath, buffer, {
    contentType: file.type,
    upsert: false
  });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });

  const { data: signedUrlData, error: signedUrlError } = await admin.storage.from("message-attachments").createSignedUrl(storagePath, 60 * 60);
  if (signedUrlError) {
    await admin.storage.from("message-attachments").remove([storagePath]);
    return NextResponse.json({ error: signedUrlError.message }, { status: 400 });
  }

  return NextResponse.json({
    attachment: {
      url: signedUrlData.signedUrl,
      path: storagePath,
      name: file.name,
      type: file.type,
      size: file.size
    }
  });
}
