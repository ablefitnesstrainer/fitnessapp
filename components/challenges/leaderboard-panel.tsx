"use client";

import { useEffect, useMemo, useState } from "react";

type ChallengeItem = {
  id: string;
  name: string;
  status: "draft" | "active" | "closed";
  starts_on: string;
  ends_on: string;
};

type LeaderboardConfig = {
  ranking_slot: number;
  label: string;
};

type LeaderboardRow = {
  rank: number;
  member_name: string;
  score: number;
  delta: number | null;
};

export function LeaderboardPanel({ showHeader = true }: { showHeader?: boolean }) {
  const [challenges, setChallenges] = useState<ChallengeItem[]>([]);
  const [activeChallengeId, setActiveChallengeId] = useState<string>("");
  const [configs, setConfigs] = useState<LeaderboardConfig[]>([]);
  const [slot, setSlot] = useState<number>(1);
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const res = await fetch("/api/challenges?status=active", { cache: "no-store" });
      const payload = (await res.json().catch(() => null)) as { challenges?: ChallengeItem[]; error?: string } | null;
      if (!active) return;

      if (!res.ok) {
        setStatus(payload?.error || "Unable to load leaderboard right now.");
        setLoading(false);
        return;
      }

      const list = payload?.challenges || [];
      setChallenges(list);
      if (list[0]) {
        setActiveChallengeId(list[0].id);
      }
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  async function loadLeaderboard(reset = false) {
    if (!activeChallengeId) return;

    const cursor = reset ? null : nextCursor;
    if (!reset && cursor === null) return;

    reset ? setLoading(true) : setLoadingMore(true);

    const url = new URL(`/api/challenges/${activeChallengeId}/leaderboard`, window.location.origin);
    url.searchParams.set("slot", String(slot));
    url.searchParams.set("limit", "40");
    if (cursor !== null) url.searchParams.set("cursor", String(cursor));

    const res = await fetch(url.toString(), { cache: "no-store" });
    const payload = (await res.json().catch(() => null)) as {
      items?: LeaderboardRow[];
      next_cursor?: number | null;
      configs?: LeaderboardConfig[];
      error?: string;
    } | null;

    if (!res.ok) {
      setStatus(payload?.error || "Unable to load leaderboard.");
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    setStatus(null);
    setConfigs((payload?.configs || []).map((cfg) => ({ ranking_slot: cfg.ranking_slot, label: cfg.label })));
    setRows((prev) => (reset ? payload?.items || [] : [...prev, ...(payload?.items || [])]));
    setNextCursor(payload?.next_cursor ?? null);

    setLoading(false);
    setLoadingMore(false);
  }

  useEffect(() => {
    if (!activeChallengeId) return;
    setRows([]);
    setNextCursor(0);
  }, [activeChallengeId, slot]);

  useEffect(() => {
    if (nextCursor === 0 && activeChallengeId) {
      void loadLeaderboard(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextCursor, activeChallengeId, slot]);

  const selectedChallenge = useMemo(() => challenges.find((c) => c.id === activeChallengeId) || null, [challenges, activeChallengeId]);

  return (
    <section className="card space-y-3">
      {showHeader && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Challenge Leaderboard</h2>
            <p className="text-sm text-slate-600">All participants, ranked by adherence metrics.</p>
          </div>
          <a href="/challenges" className="btn-secondary">
            Open Challenge Hub
          </a>
        </div>
      )}

      <div className="grid gap-2 md:grid-cols-2">
        <label>
          <span className="label">Challenge</span>
          <select className="input" value={activeChallengeId} onChange={(e) => setActiveChallengeId(e.target.value)}>
            {challenges.map((challenge) => (
              <option key={challenge.id} value={challenge.id}>
                {challenge.name} ({challenge.starts_on} - {challenge.ends_on})
              </option>
            ))}
          </select>
        </label>
      </div>

      {configs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {configs.map((config) => (
            <button
              key={config.ranking_slot}
              className={config.ranking_slot === slot ? "btn-primary" : "btn-secondary"}
              onClick={() => setSlot(config.ranking_slot)}
              type="button"
            >
              {config.label}
            </button>
          ))}
        </div>
      )}

      {status && <p className="text-sm text-rose-600">{status}</p>}
      {!status && !loading && !selectedChallenge && <p className="text-sm text-slate-600">No active challenge available yet.</p>}

      {selectedChallenge && (
        <div className="max-h-[420px] overflow-y-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-3 py-2">Rank</th>
                <th className="px-3 py-2">Member</th>
                <th className="px-3 py-2">Score</th>
                <th className="px-3 py-2">Delta</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading && (
                <tr>
                  <td className="px-3 py-5 text-slate-500" colSpan={4}>
                    Leaderboard has no scores yet.
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={`${row.rank}-${row.member_name}`} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-semibold text-slate-900">#{row.rank}</td>
                  <td className="px-3 py-2 text-slate-800">{row.member_name}</td>
                  <td className="px-3 py-2 font-semibold text-slate-900">{row.score.toFixed(2)}</td>
                  <td className="px-3 py-2">
                    {row.delta === null ? (
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">-</span>
                    ) : row.delta >= 0 ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">+{row.delta.toFixed(2)}</span>
                    ) : (
                      <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700">{row.delta.toFixed(2)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedChallenge && nextCursor !== null && (
        <button className="btn-secondary" disabled={loadingMore} onClick={() => void loadLeaderboard(false)} type="button">
          {loadingMore ? "Loading..." : "Load more"}
        </button>
      )}
    </section>
  );
}
