import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { enforceRateLimit } from "@/lib/security-controls";

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  result.push(current.trim());
  return result;
}

function parseCsv(csvText: string) {
  const cleaned = csvText.replace(/^\uFEFF/, "");
  const lines = cleaned
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
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

  const resolveName = (row: Record<string, string>) =>
    row.name || row.exercise_name || row.exercise || row.exercise_title || row.title || "";

  const rowsWithResolved: Array<Record<string, string> & { __resolved_name: string }> = rows.map((row) => ({
    ...row,
    __resolved_name: resolveName(row)
  }));

  const payload = rowsWithResolved
    .filter((row) => row.__resolved_name)
    .map((row) => ({
      name: row.__resolved_name,
      primary_muscle: row.primary_muscle || null,
      secondary_muscle: row.secondary_muscle || null,
      equipment: row.equipment || null,
      difficulty: row.difficulty || null,
      video_url: row.video_url || null,
      instructions: row.instructions || null,
      created_by: user.id
    }));

  if (!payload.length) {
    return NextResponse.json({ error: "CSV has no valid exercise rows with a name." }, { status: 400 });
  }

  const normalizedCsvNames = payload.map((row) => row.name.trim().toLowerCase());
  const duplicateInFileSet = new Set<string>();
  const seen = new Set<string>();
  for (const name of normalizedCsvNames) {
    if (seen.has(name)) {
      duplicateInFileSet.add(name);
    } else {
      seen.add(name);
    }
  }

  const { data: existingExercises, error: existingError } = await supabase.from("exercises").select("name");
  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 400 });
  }

  const existingNameSet = new Set((existingExercises || []).map((entry) => entry.name.trim().toLowerCase()));
  const duplicateExistingSet = new Set<string>();
  const uniquePayload = payload.filter((row) => {
    const normalizedName = row.name.trim().toLowerCase();
    if (duplicateInFileSet.has(normalizedName)) return false;
    if (existingNameSet.has(normalizedName)) {
      duplicateExistingSet.add(normalizedName);
      return false;
    }
    return true;
  });

  const { error } = uniquePayload.length ? await supabase.from("exercises").insert(uniquePayload) : { error: null };

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { data: exercises, error: listError } = await supabase.from("exercises").select("*").order("name");

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 400 });
  }

  return NextResponse.json({
    inserted: uniquePayload.length,
    skipped_duplicates_existing: duplicateExistingSet.size,
    skipped_duplicates_in_file: duplicateInFileSet.size,
    duplicate_existing_names: Array.from(duplicateExistingSet).slice(0, 20),
    duplicate_in_file_names: Array.from(duplicateInFileSet).slice(0, 20),
    exercises
  });
}
