const SENSITIVE_SECURITY_ACTIONS = new Set([
  "admin.reset_password",
  "client.delete",
  "clients.assign_template",
  "challenge.bulk_enroll",
  "security.settings_update",
  "security.operations_update",
  "contracts.send"
]);

export function isSensitiveSecurityAction(action: string) {
  return SENSITIVE_SECURITY_ACTIONS.has(action);
}

export function securityDeviceFingerprint(ua: string | null) {
  if (!ua) return "unknown";
  const value = ua.toLowerCase();

  const browser = value.includes("edg/")
    ? "edge"
    : value.includes("chrome/")
      ? "chrome"
      : value.includes("safari/") && !value.includes("chrome/")
        ? "safari"
        : value.includes("firefox/")
          ? "firefox"
          : "other";

  const os = value.includes("windows")
    ? "windows"
    : value.includes("mac os") || value.includes("macintosh")
      ? "macos"
      : value.includes("iphone") || value.includes("ipad") || value.includes("ios")
        ? "ios"
        : value.includes("android")
          ? "android"
          : value.includes("linux")
            ? "linux"
            : "other";

  return `${browser}:${os}`;
}

export function detectSecurityAnomaly(params: {
  history: Array<{ ip_address: string | null; user_agent: string | null }>;
  currentIp: string | null;
  currentUserAgent: string | null;
}) {
  const reasons: string[] = [];
  if (!params.history.length) return { isAnomaly: false, reasons };

  const knownIps = new Set(params.history.map((entry) => entry.ip_address || "unknown"));
  const knownDevices = new Set(params.history.map((entry) => securityDeviceFingerprint(entry.user_agent)));

  const ip = params.currentIp || "unknown";
  const device = securityDeviceFingerprint(params.currentUserAgent);

  if (!knownIps.has(ip)) reasons.push("new IP");
  if (!knownDevices.has(device)) reasons.push("new device profile");

  return {
    isAnomaly: reasons.length > 0,
    reasons,
    deviceFingerprint: device
  };
}

export const sensitiveSecurityActions = Array.from(SENSITIVE_SECURITY_ACTIONS);
