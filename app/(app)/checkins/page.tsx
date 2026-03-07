import { CheckinForm } from "@/components/checkins/checkin-form";
import { createClient } from "@/lib/supabase-server";
import { displayNameFromIdentity } from "@/lib/display-name";
import { getCurrentAppUser, getCurrentClientProfile } from "@/services/auth-service";

export default async function CheckinsPage() {
  const supabase = createClient();
  const appUser = await getCurrentAppUser();

  if (appUser.role === "client") {
    const client = await getCurrentClientProfile();
    if (!client) {
      return <p className="text-sm text-red-600">Client profile not found.</p>;
    }

    const { data: checkins, error } = await supabase
      .from("checkins")
      .select("*")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Weekly Check-ins</h1>
        <CheckinForm clientId={client.id} initialCheckins={checkins || []} />
      </section>
    );
  }

  const { data: checkins, error } = await supabase
    .from("checkins")
    .select("*,clients(user_id,app_users!clients_user_id_fkey(email))")
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
            email: joinedUser?.email,
            fallbackId: clients?.user_id
          });
          return (
            <article key={entry.id} className="rounded-lg bg-slate-50 p-3 text-sm">
              <p className="font-medium">{userName}</p>
              <p>
                {new Date(entry.created_at).toLocaleDateString()} | Adherence {entry.adherence} | Energy {entry.energy} | Sleep {entry.sleep}
              </p>
              {entry.notes && <p className="mt-1">{entry.notes}</p>}
            </article>
          );
        })}
      </div>
    </section>
  );
}
