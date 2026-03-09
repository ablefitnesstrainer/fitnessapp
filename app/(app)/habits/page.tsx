import { HabitManager } from "@/components/habits/habit-manager";
import { getCurrentAppUser, getCurrentClientProfile } from "@/services/auth-service";

export default async function HabitsPage() {
  const appUser = await getCurrentAppUser();

  if (appUser.role !== "client") {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Habits</h1>
        <p className="text-slate-700">For coach/admin accounts, manage habits inside each client profile.</p>
      </section>
    );
  }

  const client = await getCurrentClientProfile();
  if (!client) {
    return <p className="text-sm text-red-600">Client profile not found.</p>;
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Habit Tracker</h1>
      <HabitManager clientId={client.id} mode="client" />
    </section>
  );
}
