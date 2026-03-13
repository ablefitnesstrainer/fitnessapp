"use client";

import clsx from "clsx";

function initialsFromName(name?: string) {
  const trimmed = (name || "").trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "?";
}

export function UserAvatar({
  name,
  photoUrl,
  size = 32,
  className
}: {
  name?: string;
  photoUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const initials = initialsFromName(name);

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name ? `${name} profile photo` : "Profile photo"}
        className={clsx("rounded-full border border-slate-200 object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={clsx(
        "inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-600",
        className
      )}
      style={{ width: size, height: size }}
      aria-label={name ? `${name} initials` : "User initials"}
    >
      {initials}
    </div>
  );
}
