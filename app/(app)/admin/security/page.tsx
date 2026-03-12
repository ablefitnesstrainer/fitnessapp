import { createClient } from "@/lib/supabase-server";
import { getCurrentAppUser } from "@/services/auth-service";
import Link from "next/link";

type SearchParams = {
  action?: string;
  entity_type?: string;
  actor_id?: string;
  from?: string;
  to?: string;
};

type AuditLogRow = {
  id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

type ActorRow = {
  id: string;
  email: string;
  role: "admin" | "coach" | "client";
  full_name: string | null;
};

type LoginLockoutRow = {
  email: string;
  failed_attempts: number;
  locked_until: string | null;
  updated_at: string;
};

function formatActorName(actor: ActorRow | undefined) {
  if (!actor) return "Unknown";
  const name = actor.full_name?.trim();
  if (name) return name;
  const emailPrefix = actor.email.split("@")[0];
  return emailPrefix || actor.email;
}

export default async function AdminSecurityPage({ searchParams }: { searchParams?: SearchParams }) {
  const appUser = await getCurrentAppUser();

  if (appUser.role !== "admin") {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Security Log</h1>
        <p className="text-sm text-red-600">Admin access required.</p>
      </section>
    );
  }

  const supabase = createClient();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: passwordResetCount },
    { count: clientDeleteCount },
    { count: unusualAdminChangesCount },
    { data: lockoutRows }
  ] = await Promise.all([
    supabase
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("action", "admin.reset_password")
      .gte("created_at", since24h),
    supabase
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("action", "client.delete")
      .gte("created_at", since24h),
    supabase
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .in("action", ["admin.reset_password", "client.delete", "clients.assign_template"])
      .gte("created_at", since24h),
    supabase
      .from("login_lockouts")
      .select("email,failed_attempts,locked_until,updated_at")
      .gte("failed_attempts", 1)
      .order("updated_at", { ascending: false })
      .limit(20)
  ]);

  const lockouts = (lockoutRows ?? []) as LoginLockoutRow[];
  const activeLockouts = lockouts.filter((row) => row.locked_until && new Date(row.locked_until).getTime() > Date.now());

  let query = supabase
    .from("audit_logs")
    .select("id,actor_id,action,entity_type,entity_id,metadata,ip_address,user_agent,created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (searchParams?.action?.trim()) {
    query = query.eq("action", searchParams.action.trim());
  }
  if (searchParams?.entity_type?.trim()) {
    query = query.eq("entity_type", searchParams.entity_type.trim());
  }
  if (searchParams?.actor_id?.trim()) {
    query = query.eq("actor_id", searchParams.actor_id.trim());
  }
  if (searchParams?.from?.trim()) {
    query = query.gte("created_at", `${searchParams.from.trim()}T00:00:00.000Z`);
  }
  if (searchParams?.to?.trim()) {
    query = query.lte("created_at", `${searchParams.to.trim()}T23:59:59.999Z`);
  }

  const { data: logsData, error: logsError } = await query;

  if (logsError) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Security Log</h1>
        <p className="text-sm text-red-600">{logsError.message}</p>
      </section>
    );
  }

  const logs = (logsData ?? []) as AuditLogRow[];
  const actorIds = [...new Set(logs.map((log) => log.actor_id).filter(Boolean))];
  let actorsById = new Map<string, ActorRow>();

  if (actorIds.length) {
    const { data: actorRows } = await supabase.from("app_users").select("id,email,role,full_name").in("id", actorIds);
    actorsById = new Map((actorRows ?? []).map((row) => [row.id, row as ActorRow]));
  }

  const allActions = [...new Set(logs.map((log) => log.action))];
  const allEntityTypes = [...new Set(logs.map((log) => log.entity_type))];

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Security Log</h1>
        <p className="text-sm text-slate-600">Tracks sensitive administrative changes and account-level actions.</p>
        <Link href="/admin/security/settings" className="mt-2 inline-flex text-sm font-semibold text-blue-700 hover:text-blue-800">
          Open security settings
        </Link>
        <Link href="/admin/security/operations" className="mt-2 ml-4 inline-flex text-sm font-semibold text-blue-700 hover:text-blue-800">
          Open security operations checklist
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active lockouts</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{activeLockouts.length}</p>
          <p className="text-xs text-slate-500">Accounts currently blocked from login.</p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Password resets (24h)</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{passwordResetCount || 0}</p>
          <p className="text-xs text-slate-500">Alert if this spikes unexpectedly.</p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Client deletes (24h)</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{clientDeleteCount || 0}</p>
          <p className="text-xs text-slate-500">Destructive actions should stay rare.</p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sensitive changes (24h)</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{unusualAdminChangesCount || 0}</p>
          <p className="text-xs text-slate-500">Resets, deletes, and assignments combined.</p>
        </div>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Failed Attempts</th>
              <th className="px-4 py-3">Locked Until</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody>
            {lockouts.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={4}>
                  No recent login failures.
                </td>
              </tr>
            )}
            {lockouts.map((row) => (
              <tr key={row.email} className="border-t border-slate-100">
                <td className="px-4 py-3 font-semibold text-slate-900">{row.email}</td>
                <td className="px-4 py-3 text-slate-700">{row.failed_attempts}</td>
                <td className="px-4 py-3 text-slate-700">{row.locked_until ? new Date(row.locked_until).toLocaleString() : "-"}</td>
                <td className="px-4 py-3 text-slate-600">{new Date(row.updated_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form className="card grid gap-3 md:grid-cols-6">
        <div>
          <label className="label">Action</label>
          <select name="action" defaultValue={searchParams?.action ?? ""} className="input">
            <option value="">All</option>
            {allActions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Entity</label>
          <select name="entity_type" defaultValue={searchParams?.entity_type ?? ""} className="input">
            <option value="">All</option>
            {allEntityTypes.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Actor</label>
          <select name="actor_id" defaultValue={searchParams?.actor_id ?? ""} className="input">
            <option value="">All</option>
            {[...actorsById.values()].map((actor) => (
              <option key={actor.id} value={actor.id}>
                {formatActorName(actor)} ({actor.role})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">From</label>
          <input name="from" type="date" defaultValue={searchParams?.from ?? ""} className="input" />
        </div>
        <div>
          <label className="label">To</label>
          <input name="to" type="date" defaultValue={searchParams?.to ?? ""} className="input" />
        </div>
        <div className="flex items-end gap-2">
          <button className="btn-primary w-full" type="submit">
            Apply
          </button>
          <a href="/admin/security" className="btn-secondary w-full text-center">
            Reset
          </a>
        </div>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">Details</th>
              <th className="px-4 py-3">IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={6}>
                  No matching security activity.
                </td>
              </tr>
            )}
            {logs.map((log) => {
              const actor = actorsById.get(log.actor_id);
              const metadataPreview = log.metadata && Object.keys(log.metadata).length ? JSON.stringify(log.metadata) : "-";

              return (
                <tr key={log.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-3 text-slate-700">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{formatActorName(actor)}</p>
                    <p className="text-xs text-slate-500">{actor?.email ?? log.actor_id}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{log.action}</td>
                  <td className="px-4 py-3 text-slate-700">
                    <p>{log.entity_type}</p>
                    {log.entity_id && <p className="text-xs text-slate-500">{log.entity_id}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    <pre className="max-w-[420px] overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2">{metadataPreview}</pre>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{log.ip_address || "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
