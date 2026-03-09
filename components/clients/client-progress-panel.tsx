"use client";

import { useEffect, useMemo, useState } from "react";

type Photo = {
  id: string;
  photo_url: string;
  caption?: string | null;
  taken_at: string;
  created_at: string;
};

type Note = {
  id: string;
  note: string;
  created_at: string;
};

type TimelineEvent = {
  id: string;
  type: string;
  at: string;
  title: string;
  detail?: string;
};

export function ClientProgressPanel({ clientId }: { clientId: string }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [photoForm, setPhotoForm] = useState({ photo_url: "", caption: "", taken_at: new Date().toISOString().slice(0, 10) });
  const [noteForm, setNoteForm] = useState("");
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const load = async () => {
    const [progressRes, timelineRes] = await Promise.all([
      fetch(`/api/clients/progress?client_id=${encodeURIComponent(clientId)}`, { cache: "no-store" }),
      fetch(`/api/clients/timeline?client_id=${encodeURIComponent(clientId)}`, { cache: "no-store" })
    ]);

    const progressPayload = await progressRes.json();
    const timelinePayload = await timelineRes.json();
    if (!progressRes.ok) {
      setStatus(progressPayload.error || "Failed to load progress");
      return;
    }
    if (!timelineRes.ok) {
      setStatus(timelinePayload.error || "Failed to load timeline");
      return;
    }

    setPhotos(progressPayload.photos || []);
    setNotes(progressPayload.notes || []);
    setTimeline(timelinePayload.events || []);
  };

  useEffect(() => {
    void load();
  }, [clientId]);

  const selectedCompare = useMemo(() => photos.filter((p) => compareIds.includes(p.id)).slice(0, 2), [photos, compareIds]);

  const addPhoto = async () => {
    if (!photoForm.photo_url.trim()) {
      setStatus("Photo URL is required.");
      return;
    }

    setPending("photo");
    const res = await fetch("/api/clients/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, type: "photo", ...photoForm })
    });

    const payload = await res.json();
    if (!res.ok) {
      setStatus(payload.error || "Failed to add photo");
      setPending(null);
      return;
    }

    setPhotos((prev) => [payload.photo, ...prev]);
    setPhotoForm({ photo_url: "", caption: "", taken_at: new Date().toISOString().slice(0, 10) });
    setPending(null);
    setStatus("Progress photo added.");
    void load();
  };

  const addNote = async () => {
    if (!noteForm.trim()) {
      setStatus("Note is required.");
      return;
    }

    setPending("note");
    const res = await fetch("/api/clients/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, type: "note", note: noteForm })
    });

    const payload = await res.json();
    if (!res.ok) {
      setStatus(payload.error || "Failed to add note");
      setPending(null);
      return;
    }

    setNotes((prev) => [payload.note, ...prev]);
    setNoteForm("");
    setPending(null);
    setStatus("Coach note added.");
    void load();
  };

  const removeItem = async (type: "photo" | "note", id: string) => {
    setPending(`${type}-${id}`);
    const res = await fetch(`/api/clients/progress?client_id=${encodeURIComponent(clientId)}&type=${type}&id=${id}`, { method: "DELETE" });
    const payload = await res.json();
    if (!res.ok) {
      setStatus(payload.error || "Failed to delete");
      setPending(null);
      return;
    }
    if (type === "photo") setPhotos((prev) => prev.filter((p) => p.id !== id));
    if (type === "note") setNotes((prev) => prev.filter((n) => n.id !== id));
    setPending(null);
    setStatus("Deleted.");
    void load();
  };

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card space-y-3">
          <h3 className="text-lg font-semibold">Progress Photos</h3>
          <div className="grid gap-2">
            <input className="input" placeholder="Photo URL (https://...)" value={photoForm.photo_url} onChange={(e) => setPhotoForm((p) => ({ ...p, photo_url: e.target.value }))} />
            <div className="grid gap-2 md:grid-cols-2">
              <input className="input" placeholder="Caption (optional)" value={photoForm.caption} onChange={(e) => setPhotoForm((p) => ({ ...p, caption: e.target.value }))} />
              <input className="input" type="date" value={photoForm.taken_at} onChange={(e) => setPhotoForm((p) => ({ ...p, taken_at: e.target.value }))} />
            </div>
            <button className="btn-primary" onClick={addPhoto} disabled={pending === "photo"}>
              {pending === "photo" ? "Adding..." : "Add Progress Photo"}
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {photos.map((photo) => (
              <div key={photo.id} className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                <img src={photo.photo_url} alt={photo.caption || "Progress photo"} className="h-44 w-full rounded-lg object-cover" />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-slate-700">{photo.taken_at ? new Date(photo.taken_at).toLocaleDateString() : "-"}</p>
                    {photo.caption && <p className="text-xs text-slate-600">{photo.caption}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-secondary" onClick={() => toggleCompare(photo.id)}>
                      {compareIds.includes(photo.id) ? "Selected" : "Compare"}
                    </button>
                    <button className="text-xs font-semibold text-rose-700" onClick={() => removeItem("photo", photo.id)} disabled={pending === `photo-${photo.id}`}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card space-y-3">
          <h3 className="text-lg font-semibold">Coach Notes</h3>
          <textarea className="input min-h-[110px]" placeholder="Add private coaching note..." value={noteForm} onChange={(e) => setNoteForm(e.target.value)} />
          <button className="btn-primary" onClick={addNote} disabled={pending === "note"}>
            {pending === "note" ? "Adding..." : "Add Note"}
          </button>

          <div className="space-y-2">
            {notes.map((note) => (
              <article key={note.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm text-slate-800">{note.note}</p>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-slate-500">{new Date(note.created_at).toLocaleString()}</p>
                  <button className="text-xs font-semibold text-rose-700" onClick={() => removeItem("note", note.id)} disabled={pending === `note-${note.id}`}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>

      {selectedCompare.length === 2 && (
        <div className="card">
          <h3 className="mb-3 text-lg font-semibold">Side-by-Side Compare</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {selectedCompare.map((photo) => (
              <figure key={photo.id} className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                <img src={photo.photo_url} alt={photo.caption || "Progress comparison photo"} className="h-80 w-full rounded-lg object-cover" />
                <figcaption className="mt-2 text-xs text-slate-600">
                  {new Date(photo.taken_at).toLocaleDateString()} {photo.caption ? `| ${photo.caption}` : ""}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="mb-3 text-lg font-semibold">Client Timeline</h3>
        <div className="space-y-2">
          {timeline.map((event) => (
            <div key={event.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-slate-900">{event.title}</p>
                <p className="text-xs text-slate-500">{new Date(event.at).toLocaleString()}</p>
              </div>
              {event.detail && <p className="mt-1 text-sm text-slate-700">{event.detail}</p>}
            </div>
          ))}
        </div>
      </div>

      {status && <p className="text-sm text-slate-700">{status}</p>}
    </div>
  );
}
