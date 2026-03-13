export const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

export function isSubscriptionActive(status?: string | null) {
  if (!status) return false;
  return ACTIVE_SUBSCRIPTION_STATUSES.has(status);
}

export function isBillingEnforced() {
  return process.env.NEXT_PUBLIC_BILLING_ENFORCED === "true" || process.env.BILLING_ENFORCED === "true";
}
