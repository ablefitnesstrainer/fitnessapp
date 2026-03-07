import { PasswordAdminForm } from "@/components/admin/password-admin-form";
import { getCurrentAppUser } from "@/services/auth-service";

export default async function AdminUsersPage() {
  const appUser = await getCurrentAppUser();

  if (appUser.role !== "admin") {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Admin Users</h1>
        <p className="text-sm text-red-600">Admin access required.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Admin Users</h1>
      <PasswordAdminForm />
    </section>
  );
}
