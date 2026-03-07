export function displayNameFromIdentity(input: { fullName?: string | null; email?: string | null; fallbackId?: string | null }) {
  const fullName = input.fullName?.trim();
  if (fullName) return fullName;

  const email = input.email?.trim();
  if (email) {
    const local = email.split("@")[0] || "";
    const normalized = local
      .replace(/[._-]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");

    if (normalized) {
      return normalized
        .split(" ")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
    }
  }

  if (input.fallbackId) return `User ${input.fallbackId.slice(0, 6)}`;
  return "User";
}
