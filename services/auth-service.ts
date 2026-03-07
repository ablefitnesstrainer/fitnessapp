import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { displayNameFromIdentity } from "@/lib/display-name";

export async function requireUser() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function getCurrentAppUser() {
  const user = await requireUser();
  const supabase = createClient();

  const { data, error } = await supabase
    .from("app_users")
    .select("id,email,role")
    .eq("id", user.id)
    .single();

  if (error) {
    throw error;
  }

  return {
    ...data,
    display_name: displayNameFromIdentity({
      fullName: user.user_metadata?.full_name,
      email: data.email,
      fallbackId: data.id
    })
  };
}

export async function getCurrentClientProfile() {
  const appUser = await getCurrentAppUser();
  const supabase = createClient();

  const { data, error } = await supabase.from("clients").select("*").eq("user_id", appUser.id).maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}
