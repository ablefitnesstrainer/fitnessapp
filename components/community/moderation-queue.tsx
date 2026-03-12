"use client";

import { useEffect, useState } from "react";

type Report = {
  id: string;
  post_id: string | null;
  comment_id: string | null;
  reason: string;
  resolved: boolean;
  created_at: string;
};

type Post = {
  id: string;
  body: string;
  is_hidden: boolean;
  created_at: string;
};

type Comment = {
  id: string;
  post_id: string;
  body: string;
  is_hidden: boolean;
  created_at: string;
};

export function ModerationQueue() {
  const [reports, setReports] = useState<Report[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadQueue() {
    setLoading(true);
    const res = await fetch("/api/community/moderation", { cache: "no-store" });
    const payload = (await res.json().catch(() => null)) as {
      reports?: Report[];
      posts?: Post[];
      comments?: Comment[];
      error?: string;
    } | null;

    if (!res.ok) {
      setStatus(payload?.error || "Unable to load moderation queue");
      setLoading(false);
      return;
    }

    setReports(payload?.reports || []);
    setPosts(payload?.posts || []);
    setComments(payload?.comments || []);
    setStatus(null);
    setLoading(false);
  }

  useEffect(() => {
    void loadQueue();
  }, []);

  async function moderate(targetType: "post" | "comment" | "report", targetId: string, action: "hide" | "unhide" | "delete" | "resolve") {
    const reason = action === "hide" ? window.prompt("Reason for moderation (optional):") || undefined : undefined;
    const res = await fetch("/api/community/moderation", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_type: targetType, target_id: targetId, action, reason })
    });

    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setStatus(payload?.error || "Moderation action failed");
      return;
    }

    setStatus("Moderation updated.");
    await loadQueue();
  }

  const postById = new Map(posts.map((post) => [post.id, post]));
  const commentById = new Map(comments.map((comment) => [comment.id, comment]));

  return (
    <section className="space-y-4">
      {status && <p className="text-sm text-slate-700">{status}</p>}
      {loading && <p className="text-sm text-slate-600">Loading moderation queue...</p>}

      <div className="card overflow-x-auto p-0">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.14em] text-slate-500">
            <tr>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Reason</th>
              <th className="px-3 py-2">Content</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.length === 0 && !loading && (
              <tr>
                <td className="px-3 py-4 text-slate-500" colSpan={5}>
                  No reports currently.
                </td>
              </tr>
            )}
            {reports.map((report) => {
              const post = report.post_id ? postById.get(report.post_id) : null;
              const comment = report.comment_id ? commentById.get(report.comment_id) : null;
              const targetType = report.post_id ? "post" : "comment";
              const targetId = report.post_id || report.comment_id || "";

              return (
                <tr key={report.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2 text-xs text-slate-600">{new Date(report.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2 text-sm font-semibold text-slate-800">{targetType}</td>
                  <td className="px-3 py-2 text-sm text-slate-700">{report.reason}</td>
                  <td className="px-3 py-2 text-xs text-slate-600 max-w-[360px]">{post?.body || comment?.body || "Content removed"}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      {targetId && (
                        <>
                          <button className="btn-secondary" type="button" onClick={() => void moderate(targetType, targetId, "hide")}>
                            Hide
                          </button>
                          <button className="btn-secondary" type="button" onClick={() => void moderate(targetType, targetId, "unhide")}>
                            Unhide
                          </button>
                          <button className="btn-secondary" type="button" onClick={() => void moderate(targetType, targetId, "delete")}>
                            Delete
                          </button>
                        </>
                      )}
                      <button className="btn-primary" type="button" onClick={() => void moderate("report", report.id, "resolve")}>
                        Resolve
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
