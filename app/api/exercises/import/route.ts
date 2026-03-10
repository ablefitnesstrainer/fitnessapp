import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { enforceRateLimit } from "@/lib/security-controls";

function parseCsv(csvText: string) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((header, i) => {
      row[header] = values[i] ?? "";
    });
    return row;
  });
}

export async function POST(request: Request) {
  const supabase = createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: appUser } = await supabase.from("app_users").select("role").eq("id", user.id).single();
  if (!appUser || (appUser.role !== "coach" && appUser.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limited = await enforceRateLimit({
    scope: "exercises.import_csv",
    identifier: user.id,
    limit: 8,
    windowSeconds: 60 * 60
  });
  if (limited) return limited;

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing CSV file" }, { status: 400 });
  }

  const csvText = await file.text();
  const rows = parseCsv(csvText);

  if (!rows.length) {
    return NextResponse.json({ error: "CSV file has no data" }, { status: 400 });
  }

  const payload = rows
    .filter((row) => row.name)
    .map((row) => ({
      name: row.name,
      primary_muscle: row.primary_muscle || null,
      secondary_muscle: row.secondary_muscle || null,
      equipment: row.equipment || null,
      difficulty: row.difficulty || null,
      video_url: row.video_url || null,
      instructions: row.instructions || null,
      created_by: user.id
    }));

  const { error } = await supabase.from("exercises").insert(payload);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { data: exercises, error: listError } = await supabase.from("exercises").select("*").order("name");

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 400 });
  }

  return NextResponse.json({ inserted: payload.length, exercises });
}
