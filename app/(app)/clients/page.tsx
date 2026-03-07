import { RosterTable } from "@/components/clients/roster-table";
import { createClient } from "@/lib/supabase-server";
import { displayNameFromIdentity } from "@/lib/display-name";
import { getCurrentAppUser } from "@/services/auth-service";

export default async function ClientsPage() {
  const supabase = createClient();
  const currentUser = await getCurrentAppUser();

  if (currentUser.role !== "admin" && currentUser.role !== "coach") {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Client Roster</h1>
        <p className="text-sm text-red-600">Only coach/admin accounts can view the roster.</p>
      </section>
    );
  }

  const clientsQuery =
    currentUser.role === "coach"
      ? supabase.from("clients").select("id,user_id,coach_id,age,height,goal,equipment,created_at").eq("coach_id", currentUser.id)
      : supabase.from("clients").select("id,user_id,coach_id,age,height,goal,equipment,created_at");

  const { data: clients, error: clientsError } = await clientsQuery.order("created_at", { ascending: false });

  if (clientsError) {
    throw clientsError;
  }

  const idsForLookup = Array.from(new Set((clients || []).flatMap((client) => [client.user_id, client.coach_id]).filter(Boolean)));

  const coachesQuery =
    currentUser.role === "admin"
      ? supabase.from("app_users").select("id,email,role").in("role", ["coach", "admin"])
      : supabase.from("app_users").select("id,email,role").eq("id", currentUser.id);

  const templatesQuery =
    currentUser.role === "admin"
      ? supabase.from("program_templates").select("id,name").order("name")
      : supabase.from("program_templates").select("id,name").eq("coach_id", currentUser.id).order("name");

  const [{ data: users, error: usersError }, { data: assignments, error: assignmentsError }, { data: coaches, error: coachesError }, { data: templates, error: templatesError }] = await Promise.all([
    idsForLookup.length ? supabase.from("app_users").select("id,email").in("id", idsForLookup) : Promise.resolve({ data: [], error: null }),
    (clients || []).length
      ? supabase.from("program_assignments").select("client_id,active").in("client_id", (clients || []).map((client) => client.id)).eq("active", true)
      : Promise.resolve({ data: [], error: null }),
    coachesQuery,
    templatesQuery
  ]);

  if (usersError) throw usersError;
  if (assignmentsError) throw assignmentsError;
  if (coachesError) throw coachesError;
  if (templatesError) throw templatesError;

  const userMap = new Map((users || []).map((user) => [user.id, user]));
  const assignedClientIds = new Set((assignments || []).map((assignment) => assignment.client_id));

  const rows = (clients || []).map((client) => {
    const clientUser = userMap.get(client.user_id);
    const coachUser = client.coach_id ? userMap.get(client.coach_id) : null;

    return {
      id: client.id,
      clientUserId: client.user_id,
      clientName: displayNameFromIdentity({ email: clientUser?.email, fallbackId: client.user_id }),
      coachId: client.coach_id,
      coachName: coachUser ? displayNameFromIdentity({ email: coachUser.email, fallbackId: coachUser.id }) : "Unassigned",
      goal: client.goal || "-",
      equipment: client.equipment || "-",
      age: client.age ? String(client.age) : "-",
      height: client.height ? String(client.height) : "-",
      hasActiveProgram: assignedClientIds.has(client.id),
      createdAt: new Date(client.created_at).toLocaleDateString()
    };
  });

  const coachOptions = (coaches || []).map((coach) => ({
    id: coach.id,
    name: displayNameFromIdentity({ email: coach.email, fallbackId: coach.id })
  }));

  const templateOptions = (templates || []).map((template) => ({ id: template.id, name: template.name }));

  return (
    <section className="space-y-4">
      <div className="card bg-gradient-to-r from-slate-900 via-blue-900 to-cyan-700 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">Roster</p>
        <h1 className="mt-2 text-3xl font-bold">Client Roster</h1>
        <p className="mt-2 text-sm text-blue-100">View all clients, coach assignment, profile basics, and program status in one place.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Total Clients</p>
          <p className="mt-1 text-3xl font-bold">{rows.length}</p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Programs Assigned</p>
          <p className="mt-1 text-3xl font-bold">{rows.filter((r) => r.hasActiveProgram).length}</p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Unassigned Programs</p>
          <p className="mt-1 text-3xl font-bold">{rows.filter((r) => !r.hasActiveProgram).length}</p>
        </div>
      </div>

      <RosterTable rows={rows} coaches={coachOptions} templates={templateOptions} isAdmin={currentUser.role === "admin"} />
    </section>
  );
}
