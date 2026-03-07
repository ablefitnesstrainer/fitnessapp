import { CheckinForm } from "@/components/checkins/checkin-form";
import { IntakeForm } from "@/components/checkins/intake-form";
import { createClient } from "@/lib/supabase-server";
import { displayNameFromIdentity } from "@/lib/display-name";
import { getCurrentAppUser, getCurrentClientProfile } from "@/services/auth-service";

const isMissingRelation = (code?: string) => code === "42P01";

export default async function CheckinsPage() {
  const supabase = createClient();
  const appUser = await getCurrentAppUser();

  if (appUser.role === "client") {
    const client = await getCurrentClientProfile();
    if (!client) {
      return <p className="text-sm text-red-600">Client profile not found.</p>;
    }

    const [checkinsRes, intakeRes] = await Promise.all([
      supabase.from("checkins").select("*").eq("client_id", client.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("client_intakes").select("id").eq("client_id", client.id).maybeSingle()
    ]);

    if (checkinsRes.error) throw checkinsRes.error;
    if (intakeRes.error && !isMissingRelation(intakeRes.error.code)) throw intakeRes.error;

    const intakeFeatureAvailable = !isMissingRelation(intakeRes.error?.code);
    const intakeCompleted = intakeFeatureAvailable ? Boolean(intakeRes.data?.id) : true;

    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Weekly Check-ins</h1>
        {intakeFeatureAvailable && !intakeCompleted && <IntakeForm clientId={client.id} />}
        {intakeCompleted ? (
          <CheckinForm clientId={client.id} initialCheckins={checkinsRes.data || []} />
        ) : (
          <div className="card border border-amber-200 bg-amber-50/60 text-sm text-amber-900">
            Please complete your intake above. Weekly check-ins unlock right after submission.
          </div>
        )}
      </section>
    );
  }

  const { data: checkins, error } = await supabase
    .from("checkins")
    .select("*,clients(user_id,app_users!clients_user_id_fkey(email,full_name))")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Client Check-ins</h1>
      <div className="card space-y-2">
        {(checkins || []).map((entry) => {
          const clients = Array.isArray(entry.clients) ? entry.clients[0] : entry.clients;
          const joinedUser = Array.isArray(clients?.app_users) ? clients?.app_users[0] : clients?.app_users;
          const userName = displayNameFromIdentity({
            fullName: joinedUser?.full_name,
            email: joinedUser?.email,
            fallbackId: clients?.user_id
          });
          return (
            <article key={entry.id} className="rounded-lg bg-slate-50 p-3 text-sm">
              <p className="font-medium">{userName}</p>
              <p>
                {new Date(entry.created_at).toLocaleDateString()} | Week {entry.overall_week_rating ?? "-"}/10 | Adherence {entry.nutrition_adherence_percent ?? entry.adherence}%
              </p>
              {entry.biggest_win && <p className="mt-1">Win: {entry.biggest_win}</p>}
              {entry.biggest_challenge && <p>Challenge: {entry.biggest_challenge}</p>}
              {entry.support_needed && <p>Support needed: {entry.support_needed}</p>}
            </article>
          );
        })}
      </div>
    </section>
  );
}
