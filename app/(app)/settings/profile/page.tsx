import { ProfileForm } from "@/components/settings/profile-form";
import { requireUser } from "@/services/auth-service";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export default async function ProfilePage() {
  const user = await requireUser();
  const currentName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "";
  let initialPhotoUrl: string | null = null;

  try {
    const supabase = createClient();
    const { data: appUser } = await supabase
      .from("app_users")
      .select("profile_photo_path")
      .eq("id", user.id)
      .maybeSingle();

    if (appUser?.profile_photo_path) {
      const admin = createAdminClient();
      const { data: signed } = await admin.storage.from("profile-photos").createSignedUrl(appUser.profile_photo_path, 60 * 60);
      initialPhotoUrl = signed?.signedUrl || null;
    }
  } catch {
    initialPhotoUrl = null;
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Profile Settings</h1>
      <ProfileForm initialFullName={currentName} email={user.email || ""} initialPhotoUrl={initialPhotoUrl} />
    </section>
  );
}
