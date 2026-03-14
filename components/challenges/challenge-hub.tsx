"use client";

import { useMemo, useState } from "react";
import { LeaderboardPanel } from "@/components/challenges/leaderboard-panel";

type Role = "admin" | "coach" | "client";

type Challenge = {
  id: string;
  name: string;
  description: string | null;
  logo_url?: string | null;
  welcome_video_url?: string | null;
  welcome_video_title?: string | null;
  starts_on: string;
  ends_on: string;
  status: "draft" | "active" | "closed";
  enrollment_count?: number;
  program_assignment?: {
    template_id: string;
    start_on: string;
    assignment_note: string | null;
  } | null;
  ranking_configs?: {
    ranking_slot: number;
    label: string;
    workouts_weight: number;
    checkins_weight: number;
    nutrition_weight: number;
    habits_weight: number;
    tie_breaker?: string;
  }[];
  enrolled?: boolean;
};

type ClientOption = {
  id: string;
  name: string;
};

type TemplateOption = {
  id: string;
  name: string;
};

const defaultSlots = [
  { ranking_slot: 1, label: "Overall Adherence", workouts_weight: 0.4, checkins_weight: 0.2, nutrition_weight: 0.25, habits_weight: 0.15 },
  { ranking_slot: 2, label: "Workout Consistency", workouts_weight: 0.7, checkins_weight: 0.15, nutrition_weight: 0.1, habits_weight: 0.05 },
  { ranking_slot: 3, label: "Habits & Check-ins", workouts_weight: 0.2, checkins_weight: 0.35, nutrition_weight: 0.15, habits_weight: 0.3 }
];

export function ChallengeHub({
  role,
  initialChallenges,
  clients = [],
  templates = []
}: {
  role: Role;
  initialChallenges: Challenge[];
  clients?: ClientOption[];
  templates?: TemplateOption[];
}) {
  const [challenges, setChallenges] = useState(initialChallenges || []);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [logoFiles, setLogoFiles] = useState<Record<string, File | null>>({});
  const [videoDrafts, setVideoDrafts] = useState<Record<string, { url: string; title: string }>>({});

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [challengeWelcomeVideoUrl, setChallengeWelcomeVideoUrl] = useState("");
  const [challengeWelcomeVideoTitle, setChallengeWelcomeVideoTitle] = useState("Welcome to Able Fitness");
  const [startsOn, setStartsOn] = useState(new Date().toISOString().slice(0, 10));
  const [endsOn, setEndsOn] = useState(new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10));
  const [templateId, setTemplateId] = useState(templates[0]?.id || "");
  const [assignmentStartOn, setAssignmentStartOn] = useState(new Date().toISOString().slice(0, 10));
  const [rankingMode, setRankingMode] = useState<1 | 2 | 3>(1);

  const [selectedChallengeId, setSelectedChallengeId] = useState<string>(initialChallenges[0]?.id || "");
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);

  const challengeForEnroll = useMemo(() => challenges.find((challenge) => challenge.id === selectedChallengeId) || null, [challenges, selectedChallengeId]);

  const rankingConfigs = useMemo(() => defaultSlots.slice(0, rankingMode), [rankingMode]);

  async function refreshChallenges() {
    const res = await fetch("/api/challenges", { cache: "no-store" });
    const payload = (await res.json().catch(() => null)) as { challenges?: Challenge[]; error?: string } | null;
    if (!res.ok) {
      setStatus(payload?.error || "Failed to refresh challenges");
      return;
    }
    setChallenges(payload?.challenges || []);
    if (!selectedChallengeId && payload?.challenges?.[0]?.id) {
      setSelectedChallengeId(payload.challenges[0].id);
    }
  }

  async function createChallenge() {
    if (!name.trim()) {
      setStatus("Challenge name is required.");
      return;
    }

    setPending(true);
    setStatus(null);

    const res = await fetch("/api/challenges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description,
        starts_on: startsOn,
        ends_on: endsOn,
        status: "draft",
        template_id: templateId || null,
        start_on: assignmentStartOn,
        ranking_configs: rankingConfigs,
        welcome_video_url: challengeWelcomeVideoUrl || null,
        welcome_video_title: challengeWelcomeVideoTitle || null
      })
    });

    const payload = (await res.json().catch(() => null)) as { challenge?: Challenge; error?: string } | null;
    if (!res.ok) {
      setStatus(payload?.error || "Unable to create challenge.");
      setPending(false);
      return;
    }

    setStatus("Challenge created.");
    setName("");
    setDescription("");
    setChallengeWelcomeVideoUrl("");
    setChallengeWelcomeVideoTitle("Welcome to Able Fitness");
    setPending(false);
    await refreshChallenges();
  }

  async function updateChallengeStatus(challengeId: string, action: "activate" | "close") {
    setPending(true);
    setStatus(null);
    const res = await fetch(`/api/challenges/${challengeId}/${action}`, { method: "POST" });
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setStatus(payload?.error || `Failed to ${action} challenge`);
      setPending(false);
      return;
    }
    setStatus(`Challenge ${action}d.`);
    setPending(false);
    await refreshChallenges();
  }

  async function bulkEnroll() {
    if (!selectedChallengeId) {
      setStatus("Select a challenge first.");
      return;
    }
    if (!selectedClientIds.length) {
      setStatus("Select at least one client.");
      return;
    }

    setPending(true);
    setStatus(null);

    const res = await fetch(`/api/challenges/${selectedChallengeId}/bulk-enroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_ids: selectedClientIds,
        template_id: challengeForEnroll?.program_assignment?.template_id || templateId || null,
        start_on: challengeForEnroll?.program_assignment?.start_on || assignmentStartOn
      })
    });

    const payload = (await res.json().catch(() => null)) as { enrolled_count?: number; error?: string } | null;
    if (!res.ok) {
      setStatus(payload?.error || "Bulk enroll failed.");
      setPending(false);
      return;
    }

    setStatus(`Bulk assignment complete. ${payload?.enrolled_count || 0} client(s) enrolled.`);
    setSelectedClientIds([]);
    setPending(false);
    await refreshChallenges();
  }

  async function recompute(challengeId: string) {
    setPending(true);
    setStatus(null);

    const res = await fetch(`/api/challenges/${challengeId}/leaderboard/recompute`, { method: "POST" });
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setStatus(payload?.error || "Failed to recompute leaderboard");
      setPending(false);
      return;
    }

    setStatus("Leaderboard recomputed.");
    setPending(false);
  }

  async function saveChallengeVideo(challengeId: string) {
    const draft = videoDrafts[challengeId] || { url: "", title: "Welcome to Able Fitness" };
    setPending(true);
    setStatus(null);
    const res = await fetch(`/api/challenges/${challengeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        welcome_video_url: draft.url,
        welcome_video_title: draft.title
      })
    });
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setStatus(payload?.error || "Failed to save challenge welcome video.");
      setPending(false);
      return;
    }
    setStatus("Challenge welcome video saved.");
    setPending(false);
    await refreshChallenges();
  }

  async function joinChallenge(challengeId: string) {
    setPending(true);
    setStatus(null);
    const res = await fetch(`/api/challenges/${challengeId}/join`, { method: "POST" });
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setStatus(payload?.error || "Unable to join challenge.");
      setPending(false);
      return;
    }
    setStatus("Joined challenge.");
    setPending(false);
    await refreshChallenges();
  }

  async function uploadLogo(challengeId: string) {
    const file = logoFiles[challengeId];
    if (!file) {
      setStatus("Select a logo file first.");
      return;
    }

    setPending(true);
    setStatus(null);
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`/api/challenges/${challengeId}/logo`, {
      method: "POST",
      body: formData
    });
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setStatus(payload?.error || "Failed to upload challenge logo.");
      setPending(false);
      return;
    }

    setLogoFiles((prev) => ({ ...prev, [challengeId]: null }));
    setStatus("Challenge badge updated.");
    setPending(false);
    await refreshChallenges();
  }

  return (
    <section className="space-y-5">
      <div className="card bg-gradient-to-r from-slate-900 via-blue-900 to-cyan-700 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-100">Challenges</p>
        <h1 className="mt-2 text-3xl font-bold">Monthly Challenge Hub</h1>
        <p className="mt-2 text-sm text-blue-100">Configure monthly challenges, bulk assign programs, and manage leaderboard scoring from one place.</p>
      </div>

      {status && <p className="text-sm text-slate-700">{status}</p>}

      {(role === "admin" || role === "coach") && (
        <>
          <div className="card space-y-4">
            <h2 className="text-xl font-bold">Launch Workflow</h2>
            <p className="text-sm text-slate-600">
              Create the challenge first, then upload a badge image in the "Challenge Lifecycle & Badge Upload" section below.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <label>
                <span className="label">Step 1: Challenge name</span>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="April Consistency Sprint" />
              </label>
              <label>
                <span className="label">Step 1: Description</span>
                <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Workout + nutrition + habits challenge" />
              </label>
              <label>
                <span className="label">Start date</span>
                <input className="input" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
              </label>
              <label>
                <span className="label">End date</span>
                <input className="input" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
              </label>
              <label>
                <span className="label">Template mapping</span>
                <select className="input" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                  <option value="">None</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="label">Program start date</span>
                <input className="input" type="date" value={assignmentStartOn} onChange={(e) => setAssignmentStartOn(e.target.value)} />
              </label>
              <label>
                <span className="label">Challenge welcome video title</span>
                <input
                  className="input"
                  value={challengeWelcomeVideoTitle}
                  onChange={(e) => setChallengeWelcomeVideoTitle(e.target.value)}
                  placeholder="Welcome to Able Fitness"
                />
              </label>
              <label>
                <span className="label">Challenge welcome video URL</span>
                <input
                  className="input"
                  value={challengeWelcomeVideoUrl}
                  onChange={(e) => setChallengeWelcomeVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </label>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-900">Step 2: Leaderboard ranking mode</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[1, 2, 3].map((count) => (
                  <button
                    key={count}
                    type="button"
                    className={rankingMode === count ? "btn-primary" : "btn-secondary"}
                    onClick={() => setRankingMode(count as 1 | 2 | 3)}
                  >
                    {count} ranking {count === 1 ? "category" : "categories"}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                {rankingConfigs.map((config) => (
                  <div key={config.ranking_slot} className="rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-700">
                    <p className="font-semibold text-slate-900">{config.label}</p>
                    <p>W: {config.workouts_weight} • C: {config.checkins_weight} • N: {config.nutrition_weight} • H: {config.habits_weight}</p>
                  </div>
                ))}
              </div>
            </div>

            <button className="btn-primary" type="button" disabled={pending} onClick={() => void createChallenge()}>
              {pending ? "Saving..." : "Step 3: Create Challenge"}
            </button>
          </div>

          <div className="card space-y-4">
            <h2 className="text-xl font-bold">Step 4: Bulk Assign Clients</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label>
                <span className="label">Challenge</span>
                <select className="input" value={selectedChallengeId} onChange={(e) => setSelectedChallengeId(e.target.value)}>
                  <option value="">Select challenge</option>
                  {challenges.map((challenge) => (
                    <option key={challenge.id} value={challenge.id}>
                      {challenge.name} ({challenge.status})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="label">Selected clients</span>
                <input className="input" value={selectedClientIds.length} readOnly />
              </label>
            </div>

            <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 p-2">
              {clients.length === 0 && <p className="text-sm text-slate-600">No clients available.</p>}
              {clients.map((client) => (
                <label key={client.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={selectedClientIds.includes(client.id)}
                    onChange={(e) => {
                      setSelectedClientIds((prev) =>
                        e.target.checked ? [...prev, client.id] : prev.filter((id) => id !== client.id)
                      );
                    }}
                  />
                  <span className="text-sm text-slate-700">{client.name}</span>
                </label>
              ))}
            </div>

            <button className="btn-primary" disabled={pending} onClick={() => void bulkEnroll()} type="button">
              {pending ? "Assigning..." : "Bulk Enroll + Assign Program"}
            </button>
          </div>

          <div className="card space-y-3">
            <h2 className="text-xl font-bold">Challenge Lifecycle & Badge Upload</h2>
            <div className="space-y-2">
              {challenges.length === 0 && <p className="text-sm text-slate-600">No challenges yet.</p>}
              {challenges.map((challenge) => (
                <div key={challenge.id} className="rounded-xl border border-slate-200 p-3">
                  {challenge.logo_url && (
                    <img
                      src={challenge.logo_url}
                      alt={`${challenge.name} logo`}
                      className="mb-2 h-12 w-12 rounded-xl border border-slate-200 object-cover"
                    />
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{challenge.name}</p>
                      <p className="text-xs text-slate-500">
                        {challenge.starts_on} to {challenge.ends_on} • {challenge.enrollment_count || 0} enrolled
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {challenge.status !== "active" && (
                        <button className="btn-secondary" type="button" onClick={() => void updateChallengeStatus(challenge.id, "activate")}>
                          Activate
                        </button>
                      )}
                      {challenge.status !== "closed" && (
                        <button className="btn-secondary" type="button" onClick={() => void updateChallengeStatus(challenge.id, "close")}>
                          Close
                        </button>
                      )}
                      <button className="btn-secondary" type="button" onClick={() => void recompute(challenge.id)}>
                        Recompute
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-slate-600">Badge image:</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="text-xs text-slate-600"
                      onChange={(e) =>
                        setLogoFiles((prev) => ({
                          ...prev,
                          [challenge.id]: e.target.files?.[0] || null
                        }))
                      }
                    />
                    <button className="btn-secondary" type="button" disabled={pending} onClick={() => void uploadLogo(challenge.id)}>
                      Upload Badge
                    </button>
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <label>
                      <span className="label">Welcome video title</span>
                      <input
                        className="input"
                        value={videoDrafts[challenge.id]?.title ?? challenge.welcome_video_title ?? "Welcome to Able Fitness"}
                        onChange={(e) =>
                          setVideoDrafts((prev) => ({
                            ...prev,
                            [challenge.id]: {
                              url: prev[challenge.id]?.url ?? challenge.welcome_video_url ?? "",
                              title: e.target.value
                            }
                          }))
                        }
                        placeholder="Welcome to Able Fitness"
                      />
                    </label>
                    <label>
                      <span className="label">Welcome video URL</span>
                      <input
                        className="input"
                        value={videoDrafts[challenge.id]?.url ?? challenge.welcome_video_url ?? ""}
                        onChange={(e) =>
                          setVideoDrafts((prev) => ({
                            ...prev,
                            [challenge.id]: {
                              url: e.target.value,
                              title: prev[challenge.id]?.title ?? challenge.welcome_video_title ?? "Welcome to Able Fitness"
                            }
                          }))
                        }
                        placeholder="https://www.youtube.com/watch?v=..."
                      />
                    </label>
                  </div>
                  <button className="btn-secondary mt-2" type="button" disabled={pending} onClick={() => void saveChallengeVideo(challenge.id)}>
                    Save Challenge Video
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {role === "client" && (
        <div className="card space-y-3">
          <h2 className="text-xl font-bold">Available Challenges</h2>
          {challenges.length === 0 && <p className="text-sm text-slate-600">No challenges available right now.</p>}
          {challenges.map((challenge) => (
            <div key={challenge.id} className="rounded-xl border border-slate-200 p-3">
              {challenge.logo_url && (
                <img
                  src={challenge.logo_url}
                  alt={`${challenge.name} logo`}
                  className="mb-2 h-12 w-12 rounded-xl border border-slate-200 object-cover"
                />
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{challenge.name}</p>
                  <p className="text-xs text-slate-500">
                    {challenge.starts_on} to {challenge.ends_on} • {challenge.status}
                  </p>
                  {challenge.description && <p className="mt-1 text-sm text-slate-700">{challenge.description}</p>}
                </div>
                {challenge.enrolled ? (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">Enrolled</span>
                ) : challenge.status !== "closed" ? (
                  <button className="btn-primary" type="button" disabled={pending} onClick={() => void joinChallenge(challenge.id)}>
                    Join Challenge
                  </button>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Unavailable</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <LeaderboardPanel showHeader={false} />
    </section>
  );
}
