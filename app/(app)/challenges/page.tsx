import { ChallengeHub } from "@/components/challenges/challenge-hub";
import { createClient } from "@/lib/supabase-server";
import { displayNameFromIdentity } from "@/lib/display-name";
import { getCurrentAppUser } from "@/services/auth-service";

export default async function ChallengesPage() {
  const supabase = createClient();
  const appUser = await getCurrentAppUser();

  const { data: challengesData, error: challengesError } = await fetchChallenges(supabase, appUser.id, appUser.role);
  if (challengesError) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Challenge Hub</h1>
        <p className="text-sm text-rose-600">{challengesError.message}</p>
      </section>
    );
  }

  const clients =
    appUser.role === "admin" || appUser.role === "coach"
      ? await fetchClients(supabase, appUser.id, appUser.role)
      : [];

  const templates =
    appUser.role === "admin" || appUser.role === "coach"
      ? await fetchTemplates(supabase, appUser.id, appUser.role)
      : [];

  return (
    <ChallengeHub
      role={appUser.role}
      initialChallenges={challengesData || []}
      clients={clients}
      templates={templates}
    />
  );
}

async function fetchChallenges(supabase: ReturnType<typeof createClient>, userId: string, role: "admin" | "coach" | "client") {
  if (role === "client") {
    const { data: profile } = await supabase.from("clients").select("id").eq("user_id", userId).maybeSingle();
    if (!profile) return { data: [], error: null };

    const { data: challenges, error } = await supabase
      .from("challenges")
      .select("id,name,description,starts_on,ends_on,status")
      .order("starts_on", { ascending: false });
    if (error) return { data: null, error };

    const challengeIds = (challenges || []).map((item) => item.id);
    const { data: enrollments, error: enrollmentsError } = challengeIds.length
      ? await supabase
          .from("challenge_enrollments")
          .select("challenge_id")
          .eq("client_id", profile.id)
          .in("challenge_id", challengeIds)
      : { data: [], error: null };
    if (enrollmentsError) return { data: null, error: enrollmentsError };

    const enrolled = new Set((enrollments || []).map((item) => item.challenge_id));
    return {
      data: (challenges || []).map((challenge) => ({
        ...challenge,
        enrolled: enrolled.has(challenge.id)
      })),
      error: null
    };
  }

  const query =
    role === "coach"
      ? supabase
          .from("challenges")
          .select("id,name,description,starts_on,ends_on,status,created_by,challenge_enrollments(id),challenge_program_assignments(template_id,start_on,assignment_note),challenge_leaderboard_configs(ranking_slot,label,workouts_weight,checkins_weight,nutrition_weight,habits_weight,tie_breaker)")
          .eq("created_by", userId)
      : supabase
          .from("challenges")
          .select("id,name,description,starts_on,ends_on,status,created_by,challenge_enrollments(id),challenge_program_assignments(template_id,start_on,assignment_note),challenge_leaderboard_configs(ranking_slot,label,workouts_weight,checkins_weight,nutrition_weight,habits_weight,tie_breaker)");

  const result = await query.order("starts_on", { ascending: false });

  if (result.error || !result.data) return result;

  const mapped = result.data.map((challenge: any) => ({
    id: challenge.id,
    name: challenge.name,
    description: challenge.description,
    starts_on: challenge.starts_on,
    ends_on: challenge.ends_on,
    status: challenge.status,
    enrollment_count: (challenge.challenge_enrollments || []).length,
    program_assignment: challenge.challenge_program_assignments?.[0] || null,
    ranking_configs: challenge.challenge_leaderboard_configs || []
  }));

  return { data: mapped, error: null };
}

async function fetchClients(supabase: ReturnType<typeof createClient>, userId: string, role: "admin" | "coach" | "client") {
  const clientsQuery =
    role === "coach"
      ? supabase.from("clients").select("id,user_id").eq("coach_id", userId)
      : supabase.from("clients").select("id,user_id");

  const { data: clients, error } = await clientsQuery;
  if (error || !clients?.length) return [];

  const userIds = clients.map((row) => row.user_id);
  const { data: users } = await supabase.from("app_users").select("id,email,full_name,role").in("id", userIds);
  const userById = new Map((users || []).map((user) => [user.id, user]));

  return clients
    .map((client) => {
      const identity = userById.get(client.user_id);
      if (!identity || identity.role !== "client") return null;
      return {
        id: client.id,
        name: displayNameFromIdentity({
          fullName: identity.full_name,
          email: identity.email,
          fallbackId: identity.id
        })
      };
    })
    .filter((item): item is { id: string; name: string } => Boolean(item));
}

async function fetchTemplates(supabase: ReturnType<typeof createClient>, userId: string, role: "admin" | "coach" | "client") {
  const query =
    role === "coach"
      ? supabase.from("program_templates").select("id,name").eq("coach_id", userId).order("name")
      : supabase.from("program_templates").select("id,name").order("name");

  const { data, error } = await query;
  if (error) return [];
  return (data || []).map((template) => ({ id: template.id, name: template.name }));
}
