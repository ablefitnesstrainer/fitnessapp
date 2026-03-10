import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { writeAuditLog } from "@/lib/audit-log";

export async function PATCH(request: Request) {
  const supabase = createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    client_id: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };

  if (!body.client_id) return NextResponse.json({ error: "client_id is required" }, { status: 400 });

  const { data: appUser, error: appUserError } = await supabase.from("app_users").select("role").eq("id", user.id).single();
  if (appUserError || !appUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: client, error: clientError } = await supabase.from("clients").select("id,user_id,coach_id").eq("id", body.client_id).maybeSingle();
  if (clientError || !client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const allowed = appUser.role === "admin" || client.user_id === user.id || client.coach_id === user.id;
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: target, error } = await supabase
    .from("nutrition_targets")
    .upsert(
      {
        client_id: body.client_id,
        calories: body.calories,
        protein: body.protein,
        carbs: body.carbs,
        fat: body.fat
      },
      { onConflict: "client_id" }
    )
    .select("calories,protein,carbs,fat")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog({
    supabase,
    request,
    actorId: user.id,
    action: "nutrition.targets.update",
    entityType: "client",
    entityId: body.client_id,
    metadata: { calories: body.calories, protein: body.protein, carbs: body.carbs, fat: body.fat, actor_role: appUser.role }
  });

  return NextResponse.json({ target });
}
