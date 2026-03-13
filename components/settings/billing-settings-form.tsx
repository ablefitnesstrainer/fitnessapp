"use client";

import { useMemo, useState } from "react";
import { isSubscriptionActive } from "@/lib/billing";

type BillingState = {
  role: "admin" | "coach" | "client";
  subscription_status: string;
  subscription_price_id: string | null;
  subscription_current_period_end: string | null;
  billing_updated_at: string | null;
  stripe_configured: boolean;
};

function fmtDate(value: string | null) {
  if (!value) return "-";
  const dt = new Date(value);
  if (!Number.isFinite(dt.getTime())) return "-";
  return dt.toLocaleString();
}

export function BillingSettingsForm({ initialState }: { initialState: BillingState }) {
  const [state, setState] = useState<BillingState>(initialState);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState<"checkout" | "portal" | "refresh" | null>(null);

  const active = useMemo(() => isSubscriptionActive(state.subscription_status), [state.subscription_status]);

  const refresh = async () => {
    setLoading("refresh");
    setStatus(null);
    const res = await fetch("/api/billing/status", { cache: "no-store" });
    const payload = await res.json();
    if (!res.ok) {
      setStatus(payload.error || "Failed to refresh billing status.");
      setLoading(null);
      return;
    }
    setState(payload);
    setStatus("Billing status refreshed.");
    setLoading(null);
  };

  const startCheckout = async () => {
    setLoading("checkout");
    setStatus(null);
    const res = await fetch("/api/billing/checkout", { method: "POST" });
    const payload = await res.json();
    if (!res.ok || !payload.url) {
      setStatus(payload.error || "Could not start checkout.");
      setLoading(null);
      return;
    }
    window.location.href = payload.url;
  };

  const openPortal = async () => {
    setLoading("portal");
    setStatus(null);
    const res = await fetch("/api/billing/portal", { method: "POST" });
    const payload = await res.json();
    if (!res.ok || !payload.url) {
      setStatus(payload.error || "Could not open billing portal.");
      setLoading(null);
      return;
    }
    window.location.href = payload.url;
  };

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <h2 className="text-lg font-semibold">Stripe Subscription</h2>
        {state.role === "client" && (
          <p className="text-sm text-slate-600">
            You can manage or cancel your membership directly in Stripe Billing Portal.
          </p>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="label">Status</p>
            <p className={active ? "text-sm font-semibold text-emerald-700" : "text-sm font-semibold text-amber-700"}>
              {state.subscription_status || "inactive"}
            </p>
          </div>
          <div>
            <p className="label">Current period end</p>
            <p className="text-sm font-medium text-slate-700">{fmtDate(state.subscription_current_period_end)}</p>
          </div>
          <div>
            <p className="label">Price ID</p>
            <p className="text-sm font-medium text-slate-700">{state.subscription_price_id || "-"}</p>
          </div>
          <div>
            <p className="label">Last synced</p>
            <p className="text-sm font-medium text-slate-700">{fmtDate(state.billing_updated_at)}</p>
          </div>
        </div>

        {!state.stripe_configured && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Stripe is not configured. Set `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, and `STRIPE_WEBHOOK_SECRET` in Vercel and local env.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {state.role !== "client" && (
            <button className="btn-primary" type="button" onClick={startCheckout} disabled={loading !== null || !state.stripe_configured}>
              {loading === "checkout" ? "Opening..." : active ? "Change Plan" : "Start Subscription"}
            </button>
          )}
          <button className="btn-secondary" type="button" onClick={openPortal} disabled={loading !== null || !state.stripe_configured}>
            {loading === "portal" ? "Opening..." : state.role === "client" ? "Manage or Cancel Subscription" : "Manage Billing"}
          </button>
          <button className="btn-secondary" type="button" onClick={refresh} disabled={loading !== null}>
            {loading === "refresh" ? "Refreshing..." : "Refresh Status"}
          </button>
        </div>
      </div>
      {status && <p className="text-sm font-medium text-slate-700">{status}</p>}
    </div>
  );
}
