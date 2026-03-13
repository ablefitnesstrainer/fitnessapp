"use client";

import { FormEvent, useEffect, useState } from "react";
import { UserAvatar } from "@/components/user-avatar";

type FeedComment = {
  id: string;
  post_id: string;
  body: string;
  author_name: string;
  author_photo_url?: string | null;
  created_at: string;
};

type FeedPost = {
  id: string;
  body: string;
  author_name: string;
  author_photo_url?: string | null;
  created_at: string;
  comments: FeedComment[];
};

export function EncouragementBoard({ canModerate = false }: { canModerate?: boolean }) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(0);
  const [draft, setDraft] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  async function fetchPosts(reset = false) {
    const cursor = reset ? 0 : nextCursor;
    if (cursor === null) return;

    if (reset) setLoading(true);
    else setLoadingMore(true);

    const url = new URL("/api/community/posts", window.location.origin);
    url.searchParams.set("limit", "15");
    url.searchParams.set("cursor", String(cursor));

    const res = await fetch(url.toString(), { cache: "no-store" });
    const payload = (await res.json().catch(() => null)) as { posts?: FeedPost[]; next_cursor?: number | null; error?: string } | null;

    if (!res.ok) {
      setStatus(payload?.error || "Unable to load community feed.");
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    setPosts((prev) => (reset ? payload?.posts || [] : [...prev, ...(payload?.posts || [])]));
    setNextCursor(payload?.next_cursor ?? null);
    setStatus(null);
    setLoading(false);
    setLoadingMore(false);
  }

  useEffect(() => {
    void fetchPosts(true);
  }, []);

  async function submitPost(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;

    setSending(true);
    const res = await fetch("/api/community/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body })
    });

    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setStatus(payload?.error || "Unable to publish post.");
      setSending(false);
      return;
    }

    setDraft("");
    setStatus("Post published.");
    setSending(false);
    setNextCursor(0);
    await fetchPosts(true);
  }

  async function submitComment(postId: string) {
    const body = commentDrafts[postId]?.trim();
    if (!body) return;

    const res = await fetch(`/api/community/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body })
    });

    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setStatus(payload?.error || "Unable to publish comment.");
      return;
    }

    setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
    setNextCursor(0);
    await fetchPosts(true);
  }

  async function reportPost(postId: string) {
    const reason = window.prompt("Why are you reporting this post?");
    if (!reason?.trim()) return;

    const res = await fetch("/api/community/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post_id: postId, reason })
    });

    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setStatus(payload?.error || "Unable to report post.");
      return;
    }

    setStatus("Report submitted.");
  }

  return (
    <section className="card space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Encouragement Board</h2>
          <p className="text-sm text-slate-600">Global community feed for accountability and support.</p>
        </div>
        {canModerate && (
          <a href="/community/moderation" className="btn-secondary">
            Moderation Queue
          </a>
        )}
      </div>

      <form onSubmit={submitPost} className="space-y-2">
        <label className="label">Post to the community</label>
        <textarea
          className="input min-h-[96px]"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={1200}
          placeholder="Share a win, encourage someone, or post your accountability note..."
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">{draft.length}/1200</p>
          <button className="btn-primary" disabled={sending || draft.trim().length < 3} type="submit">
            {sending ? "Posting..." : "Post"}
          </button>
        </div>
      </form>

      {status && <p className="text-sm text-slate-700">{status}</p>}

      <div className="space-y-3">
        {loading && <p className="text-sm text-slate-600">Loading board...</p>}
        {!loading && posts.length === 0 && <p className="text-sm text-slate-600">No posts yet. Start the first one.</p>}

        {posts.map((post) => (
          <article key={post.id} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <UserAvatar name={post.author_name} photoUrl={post.author_photo_url || null} size={30} />
                <div>
                  <p className="text-sm font-semibold text-slate-900">{post.author_name}</p>
                  <p className="text-xs text-slate-500">{new Date(post.created_at).toLocaleString()}</p>
                </div>
              </div>
              <button className="text-xs font-semibold text-rose-600 hover:text-rose-700" onClick={() => void reportPost(post.id)} type="button">
                Report
              </button>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{post.body}</p>

            <div className="mt-3 space-y-2 border-t border-slate-100 pt-2">
              {(post.comments || []).map((comment) => (
                <div key={comment.id} className="rounded-lg bg-slate-50 px-2 py-1.5">
                  <div className="flex items-start gap-2">
                    <UserAvatar name={comment.author_name} photoUrl={comment.author_photo_url || null} size={22} />
                    <div>
                      <p className="text-xs font-semibold text-slate-700">{comment.author_name}</p>
                      <p className="text-xs text-slate-600">{comment.body}</p>
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex gap-2">
                <input
                  className="input"
                  value={commentDrafts[post.id] || ""}
                  onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))}
                  placeholder="Add a comment"
                  maxLength={1000}
                />
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => void submitComment(post.id)}
                  disabled={(commentDrafts[post.id] || "").trim().length < 2}
                >
                  Reply
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {nextCursor !== null && (
        <button className="btn-secondary" type="button" onClick={() => void fetchPosts(false)} disabled={loadingMore}>
          {loadingMore ? "Loading..." : "Load more"}
        </button>
      )}
    </section>
  );
}
