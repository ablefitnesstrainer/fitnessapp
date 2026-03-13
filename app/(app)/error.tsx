"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const pathname = usePathname();

  useEffect(() => {
    void fetch("/api/ops/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        route: pathname,
        message: error?.message || "Unknown app error",
        stack: error?.stack || null,
        source: "app_error_boundary",
        digest: error?.digest
      })
    }).catch(() => null);
  }, [error, pathname]);

  return (
    <div className="card space-y-3">
      <h2 className="text-xl font-bold">Something went wrong</h2>
      <p className="text-sm text-slate-600">The issue has been logged. Please refresh or try again.</p>
      <button className="btn-primary" onClick={() => reset()}>
        Try again
      </button>
    </div>
  );
}

