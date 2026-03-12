"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type Factor = {
  id: string;
  status?: string;
  factor_type?: string;
  friendly_name?: string | null;
};

type AssuranceLevel = "aal1" | "aal2" | "unknown";

function normalizeAssuranceLevel(value: string | null | undefined): AssuranceLevel {
  if (value === "aal1" || value === "aal2") return value;
  return "unknown";
}

function isSvgPayload(value: string) {
  const trimmed = value.trim();
  return trimmed.startsWith("<svg") || trimmed.startsWith("<?xml");
}

export function MfaSettingsForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requiredMode = searchParams.get("required");
  const nextPath = searchParams.get("next") || "/dashboard";

  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [factors, setFactors] = useState<Factor[]>([]);
  const [assuranceLevel, setAssuranceLevel] = useState<AssuranceLevel>("unknown");
  const [nextAssuranceLevel, setNextAssuranceLevel] = useState<AssuranceLevel>("unknown");

  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null);
  const [enrollQrCode, setEnrollQrCode] = useState<string | null>(null);
  const [enrollSecret, setEnrollSecret] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");

  const verifiedFactor = factors.find((factor) => factor.status === "verified") || null;
  const mfaReady = Boolean(verifiedFactor);
  const mfaVerifiedThisSession = assuranceLevel === "aal2";

  const loadMfaState = async () => {
    setLoading(true);
    setError(null);

    const [factorsRes, aalRes] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    ]);

    if (factorsRes.error) {
      setError(factorsRes.error.message);
      setLoading(false);
      return;
    }
    if (aalRes.error) {
      setError(aalRes.error.message);
      setLoading(false);
      return;
    }

    const nextFactors = (factorsRes.data?.totp || []) as Factor[];
    setFactors(nextFactors);
    setAssuranceLevel(normalizeAssuranceLevel(aalRes.data?.currentLevel));
    setNextAssuranceLevel(normalizeAssuranceLevel(aalRes.data?.nextLevel));
    setLoading(false);
  };

  useEffect(() => {
    void loadMfaState();
  }, []);

  const enrollMfa = async () => {
    setSaving(true);
    setError(null);
    setStatus(null);

    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Able Fitness Authenticator"
    });

    if (enrollError || !data) {
      setError(enrollError?.message || "Failed to start MFA enrollment");
      setSaving(false);
      return;
    }

    setPendingFactorId(data.id);
    setEnrollQrCode(data.totp.qr_code || null);
    setEnrollSecret(data.totp.secret || null);
    setStatus("Scan the QR code, then enter a 6-digit code to verify.");
    setSaving(false);
  };

  const verifyMfa = async () => {
    const factorId = pendingFactorId || verifiedFactor?.id;
    if (!factorId) {
      setError("No MFA factor available to verify.");
      return;
    }
    if (!verificationCode.trim()) {
      setError("Enter the 6-digit authenticator code.");
      return;
    }

    setSaving(true);
    setError(null);
    setStatus(null);

    const challengeRes = await supabase.auth.mfa.challenge({ factorId });
    if (challengeRes.error || !challengeRes.data) {
      setError(challengeRes.error?.message || "Failed to start MFA challenge");
      setSaving(false);
      return;
    }

    const verifyRes = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeRes.data.id,
      code: verificationCode.trim()
    });

    if (verifyRes.error) {
      setError(verifyRes.error.message);
      setSaving(false);
      return;
    }

    setVerificationCode("");
    setPendingFactorId(null);
    setEnrollQrCode(null);
    setEnrollSecret(null);
    await fetch("/api/auth/mfa/trust", { method: "POST" });
    setStatus("MFA verified successfully. This device is now trusted.");
    await loadMfaState();
    setSaving(false);

    if (requiredMode && nextPath && nextPath.startsWith("/")) {
      router.push(nextPath);
      router.refresh();
    }
  };

  const disableMfa = async () => {
    if (!verifiedFactor?.id) return;
    const confirmed = window.confirm("Disable two-factor authentication for this account?");
    if (!confirmed) return;

    setSaving(true);
    setError(null);
    setStatus(null);

    const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: verifiedFactor.id });
    if (unenrollError) {
      setError(unenrollError.message);
      setSaving(false);
      return;
    }

    setStatus("MFA disabled.");
    await loadMfaState();
    setSaving(false);
  };

  if (loading) {
    return <section className="card">Loading MFA settings...</section>;
  }

  return (
    <section className="space-y-4">
      {requiredMode && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Two-factor authentication is required for coach/admin accounts before continuing.
        </div>
      )}

      <div className="card space-y-3">
        <h2 className="text-xl font-semibold">Two-Factor Authentication (TOTP)</h2>
        <p className="text-sm text-slate-600">
          Use an authenticator app (Google Authenticator, 1Password, Authy, etc.) to secure your account.
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Enrollment Status</p>
            <p className={`mt-1 text-sm font-semibold ${mfaReady ? "text-emerald-700" : "text-amber-700"}`}>
              {mfaReady ? "MFA enabled" : "MFA not enrolled"}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Session Assurance</p>
            <p className={`mt-1 text-sm font-semibold ${mfaVerifiedThisSession ? "text-emerald-700" : "text-amber-700"}`}>
              Current: {assuranceLevel.toUpperCase()} {nextAssuranceLevel !== "unknown" ? `• Next: ${nextAssuranceLevel.toUpperCase()}` : ""}
            </p>
          </div>
        </div>

        {!mfaReady && !pendingFactorId && (
          <button className="btn-primary" onClick={enrollMfa} disabled={saving}>
            {saving ? "Preparing..." : "Set Up MFA"}
          </button>
        )}

        {(pendingFactorId || (!mfaVerifiedThisSession && mfaReady)) && (
          <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/50 p-3">
            {enrollQrCode && (
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="mb-2 text-sm font-semibold text-slate-700">Scan QR code</p>
                {isSvgPayload(enrollQrCode) ? (
                  <div className="max-w-[220px]" dangerouslySetInnerHTML={{ __html: enrollQrCode }} />
                ) : (
                  <img src={enrollQrCode} alt="MFA QR code" className="h-44 w-44 rounded-md border border-slate-200 object-contain" />
                )}
              </div>
            )}

            {enrollSecret && (
              <p className="text-xs text-slate-600">
                Manual setup key: <span className="font-mono font-semibold text-slate-800">{enrollSecret}</span>
              </p>
            )}

            <div className="max-w-xs space-y-2">
              <label className="label">Authenticator code</label>
              <input
                className="input"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
              <button className="btn-primary" onClick={verifyMfa} disabled={saving || verificationCode.length < 6}>
                {saving ? "Verifying..." : "Verify Code"}
              </button>
            </div>
          </div>
        )}

        {mfaReady && (
          <button className="btn-secondary" onClick={disableMfa} disabled={saving}>
            {saving ? "Updating..." : "Disable MFA"}
          </button>
        )}
      </div>

      {status && <p className="text-sm text-emerald-700">{status}</p>}
      {error && <p className="text-sm text-rose-700">{error}</p>}
    </section>
  );
}
