import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getRequestIp } from "@/lib/security-controls";
import { reportOpsAlert } from "@/lib/ops-alerts";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ ok: true });

  const body = (await request.json().catch(() => ({}))) as {
    route?: string;
    message?: string;
    stack?: string;
    source?: string;
  };

  const route = (body.route || "unknown").slice(0, 300);
  const message = (body.message || "Unknown runtime error").slice(0, 2000);

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "runtime.error",
    entity_type: "frontend",
    entity_id: route,
    metadata: {
      message,
      stack: (body.stack || "").slice(0, 4000),
      source: body.source || "client"
    },
    ip_address: getRequestIp(request),
    user_agent: request.headers.get("user-agent")
  });

  await reportOpsAlert({
    alertKey: `runtime:error:${route}`,
    severity: "warning",
    message: "Frontend runtime error captured.",
    metadata: {
      route,
      message,
      actor_id: user.id,
      source: body.source || "client"
    }
  });

  return NextResponse.json({ ok: true });
}

