import { ProfileForm } from "@/components/settings/profile-form";
import { requireUser } from "@/services/auth-service";

export default async function ProfilePage() {
  const user = await requireUser();
  const currentName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "";

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Profile Settings</h1>
      <ProfileForm initialFullName={currentName} email={user.email || ""} />
    </section>
  );
}
