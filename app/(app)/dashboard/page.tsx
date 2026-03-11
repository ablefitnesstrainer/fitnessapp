import { ClientDashboard } from "@/components/dashboard/client-dashboard";
import { CoachDashboard } from "@/components/dashboard/coach-dashboard";
import { getCurrentAppUser } from "@/services/auth-service";
import { getDashboardData } from "@/services/dashboard-service";

export default async function DashboardPage() {
  const user = await getCurrentAppUser();
  const data = await getDashboardData();

  return (
    <section className="space-y-6">
      <div className="card bg-gradient-to-r from-slate-900 via-blue-900 to-cyan-700 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">Dashboard</p>
        <h1 className="mt-2 text-3xl font-bold">
          {user.role === "client" ? "Your training performance" : "Coaching command center"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-blue-100">
          {user.role === "client"
            ? "Track volume, macro compliance, and check-ins in one place."
            : "Monitor client adherence, template output, and engagement across your roster."}
        </p>
      </div>

      {user.role === "client" ? (
        <ClientDashboard workoutLogs={data.workoutLogs || []} mealLogs={data.mealLogs || []} checkins={data.checkins || []} />
      ) : (
        <CoachDashboard
          clients={data.counts?.clients || 0}
          templates={data.counts?.templates || 0}
          contractFunnel={
            data.contractFunnel || {
              sent: 0,
              opened: 0,
              completed: 0,
              sentRate: 0,
              openRate: 0,
              completionRate: 0
            }
          }
          coachDigest={
            data.coachDigest || {
              contractsPending: 0,
              overdueCheckins: 0,
              unreadMessages: 0,
              lowAdherenceClients: 0,
              checkinsThisWeek: 0
            }
          }
          checkins={data.checkins || []}
          contractQueue={data.contractQueue || []}
          priorityQueue={data.priorityQueue || []}
          overdueCheckins={data.overdueCheckins || []}
        />
      )}
    </section>
  );
}
