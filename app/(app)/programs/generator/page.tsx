import { ProgramGenerator } from "@/components/programs/program-generator";
import { createClient } from "@/lib/supabase-server";
import { displayNameFromIdentity } from "@/lib/display-name";
import { getCurrentAppUser } from "@/services/auth-service";

export default async function ProgramGeneratorPage() {
  const supabase = createClient();
  const appUser = await getCurrentAppUser();

  const templatesQuery = supabase.from("program_templates").select("id,name").order("created_at", { ascending: false });
  const clientsQuery =
    appUser.role === "coach"
      ? supabase.from("clients").select("id,user_id,app_users!clients_user_id_fkey(email,full_name,role)").eq("coach_id", appUser.id)
      : supabase.from("clients").select("id,user_id,app_users!clients_user_id_fkey(email,full_name,role)");

  const [{ data: templates, error: templatesError }, { data: clients, error: clientsError }] = await Promise.all([
    templatesQuery,
    clientsQuery
  ]);

  if (templatesError) throw templatesError;
  if (clientsError) throw clientsError;

  const normalizedClients = (clients || [])
    .filter((client) => {
      const appUserJoin = Array.isArray(client.app_users)
        ? client.app_users[0]
        : (client as { app_users?: { role?: string } }).app_users;
      return appUserJoin?.role === "client";
    })
    .map((client) => {
      const appUserJoin = Array.isArray(client.app_users)
        ? client.app_users[0]
        : (client as { app_users?: { email?: string; full_name?: string } }).app_users;

      return {
        id: client.id,
        user_id: client.user_id,
        user_name: displayNameFromIdentity({
          fullName: appUserJoin?.full_name,
          email: appUserJoin?.email,
          fallbackId: client.user_id
        })
      };
    });

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Program Generator</h1>
      <ProgramGenerator templates={templates || []} clients={normalizedClients} />
    </section>
  );
}
