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
    return { clientId: client.id };
  }

  if (!requestedClientId) return { error: NextResponse.json({ error: "client_id is required" }, { status: 400 }) };
  if (appUser.role === "admin") return { clientId: requestedClientId };

  const { data: managedClient, error: managedClientError } = await supabase
    .from("clients")
    .select("id")
    .eq("id", requestedClientId)
    .eq("coach_id", user.id)
    .maybeSingle();
  if (managedClientError || !managedClient) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { clientId: requestedClientId };
}

export async function GET(request: Request) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  const auth = await authorizeClientAccess(supabase, searchParams.get("client_id"));
  if ("error" in auth) return auth.error;

  const { data: historyRows, error: historyError } = await supabase
    .from("workout_logs")
    .select("id,day_id,started_at,completed_at,duration_minutes,total_volume")
    .eq("client_id", auth.clientId)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(50);
  if (historyError) return NextResponse.json({ error: historyError.message }, { status: 400 });

  const dayIds = Array.from(new Set((historyRows || []).map((row) => row.day_id).filter(Boolean)));

  const { data: dayRows, error: dayError } = dayIds.length
    ? await supabase.from("program_days").select("id,week_id,day_number").in("id", dayIds)
    : { data: [], error: null };
  if (dayError) return NextResponse.json({ error: dayError.message }, { status: 400 });

  const weekIds = Array.from(new Set((dayRows || []).map((row) => row.week_id).filter(Boolean)));
  const { data: weekRows, error: weekError } = weekIds.length
    ? await supabase.from("program_weeks").select("id,week_number").in("id", weekIds)
    : { data: [], error: null };
  if (weekError) return NextResponse.json({ error: weekError.message }, { status: 400 });

  const weekNumberById = new Map((weekRows || []).map((row) => [row.id, row.week_number]));
  const dayMetaById = new Map(
    (dayRows || []).map((row) => [
      row.id,
      {
        day_number: row.day_number,
        week_number: weekNumberById.get(row.week_id) ?? null
      }
    ])
  );

  const history = (historyRows || []).map((row) => {
    const meta = dayMetaById.get(row.day_id);
    return {
      id: row.id,
      started_at: row.started_at,
      completed_at: row.completed_at,
      duration_minutes: row.duration_minutes,
      total_volume: row.total_volume,
      week_number: meta?.week_number ?? null,
      day_number: meta?.day_number ?? null
    };
  });

  const { data: assignment, error: assignmentError } = await supabase
    .from("program_assignments")
    .select("template_id,start_week,current_week_number,current_day_number")
    .eq("client_id", auth.clientId)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (assignmentError) return NextResponse.json({ error: assignmentError.message }, { status: 400 });

  let upcoming: Array<{ week_number: number; day_number: number; is_current: boolean }> = [];

  if (assignment?.template_id) {
    const { data: weeks, error: weeksError } = await supabase
      .from("program_weeks")
      .select("id,week_number")
      .eq("template_id", assignment.template_id)
      .order("week_number", { ascending: true });
    if (weeksError) return NextResponse.json({ error: weeksError.message }, { status: 400 });

    const weekIdsForTemplate = (weeks || []).map((row) => row.id);
    const { data: daysForTemplate, error: daysError } = weekIdsForTemplate.length
      ? await supabase.from("program_days").select("id,week_id,day_number").in("week_id", weekIdsForTemplate).order("day_number", { ascending: true })
      : { data: [], error: null };
    if (daysError) return NextResponse.json({ error: daysError.message }, { status: 400 });

    const weekNumberByTemplateWeekId = new Map((weeks || []).map((row) => [row.id, row.week_number]));
    const allUpcomingDays = (daysForTemplate || [])
      .map((row) => ({
        week_number: weekNumberByTemplateWeekId.get(row.week_id) ?? 0,
        day_number: row.day_number
      }))
      .filter((row) => row.week_number > 0)
      .sort((a, b) => (a.week_number === b.week_number ? a.day_number - b.day_number : a.week_number - b.week_number));

    const currentWeekNumber = assignment.current_week_number ?? assignment.start_week ?? 1;
    const currentDayNumber = assignment.current_day_number ?? 1;
    upcoming = allUpcomingDays
      .filter((row) => row.week_number > currentWeekNumber || (row.week_number === currentWeekNumber && row.day_number >= currentDayNumber))
      .slice(0, 8)
      .map((row) => ({
        ...row,
        is_current: row.week_number === currentWeekNumber && row.day_number === currentDayNumber
      }));
  }

  return NextResponse.json({ history, upcoming });
}
