"use client";

import { useEffect, useRef, useState } from "react";

type Peer = { id: string; name: string; email: string; role: "admin" | "coach" | "client" };
type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  created_at: string;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_type?: string | null;
  attachment_size?: number | null;
  read_at?: string | null;
};
type MessageTemplate = { id: string; title: string; body: string; created_at: string };

export function MessagingPanel({
  currentUserId,
  peers,
  initialMessages,
  initialSelectedPeerId,
  initialPreset,
  canUseTemplates,
  initialUnreadByPeer
}: {
  currentUserId: string;
  peers: Peer[];
  initialMessages: Message[];
  initialSelectedPeerId?: string;
  initialPreset?: string;
  canUseTemplates?: boolean;
  initialUnreadByPeer?: Record<string, number>;
}) {
  const [selectedPeerId, setSelectedPeerId] = useState(initialSelectedPeerId || peers[0]?.id || "");
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState(
    initialPreset === "checkin_nudge"
      ? "Quick reminder: please submit your weekly check-in today so I can review your progress and make updates."
      : ""
  );
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [unreadByPeer, setUnreadByPeer] = useState<Record<string, number>>(initialUnreadByPeer || {});
  const [peerTyping, setPeerTyping] = useState(false);
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateBody, setTemplateBody] = useState("");
  const [uploading, setUploading] = useState(false);
  const [attachment, setAttachment] = useState<{ url: string; path: string; name: string; type: string; size: number } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);

  const loadConversation = async (peerId: string) => {
    if (!peerId) return;
    const res = await fetch(`/api/messages?peer_id=${peerId}`);
    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error || "Could not load messages");
      return;
    }
    const nextMessages = Array.isArray(data.messages) ? data.messages : [];
    setMessages((prev) => {
      const prevLast = prev[prev.length - 1]?.id;
      const nextLast = nextMessages[nextMessages.length - 1]?.id;
      if (prev.length === nextMessages.length && prevLast === nextLast) {
        return prev;
      }
      return nextMessages;
    });
    setUnreadByPeer((prev) => ({ ...prev, [peerId]: 0 }));
  };

  const loadUnread = async () => {
    const res = await fetch("/api/messages/unread");
    const payload = await res.json();
    if (!res.ok) return;
    setUnreadByPeer(payload.byPeer || {});
  };

  const loadTyping = async (peerId: string) => {
    if (!peerId) return;
    const res = await fetch(`/api/messages/typing?peer_id=${peerId}`);
    const payload = await res.json();
    if (!res.ok) return;
    setPeerTyping(Boolean(payload.typing));
  };

  useEffect(() => {
    if (!selectedPeerId) return;
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      await loadConversation(selectedPeerId);
      await loadUnread();
      await loadTyping(selectedPeerId);
    };

    void poll();
    const intervalId = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void poll();
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [selectedPeerId]);

  useEffect(() => {
    if (!selectedPeerId) return;
    if (!text.trim()) {
      const stopTyping = async () => {
        await fetch("/api/messages/typing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ receiver_id: selectedPeerId, is_typing: false })
        });
      };
      void stopTyping();
      return;
    }

    let cancelled = false;
    const sendTyping = async () => {
      if (cancelled) return;
      await fetch("/api/messages/typing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiver_id: selectedPeerId, is_typing: true })
      });
    };

    void sendTyping();
    const intervalId = setInterval(() => {
      void sendTyping();
    }, 4000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      void fetch("/api/messages/typing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiver_id: selectedPeerId, is_typing: false })
      });
    };
  }, [selectedPeerId, text]);

  useEffect(() => {
    if (!messageListRef.current) return;
    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!canUseTemplates) return;
    const loadTemplates = async () => {
      const res = await fetch("/api/messages/templates");
      const payload = await res.json();
      if (!res.ok) return;
      setTemplates(payload.templates || []);
    };
    void loadTemplates();
  }, [canUseTemplates]);

  useEffect(() => {
    void loadUnread();
  }, []);

  const uploadAttachment = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    setUploading(true);
    const res = await fetch("/api/messages/upload", { method: "POST", body: formData });
    const payload = await res.json();
    if (!res.ok) {
      setStatus(payload.error || "Failed to upload attachment");
      setUploading(false);
      return;
    }
    setAttachment(payload.attachment);
    setUploading(false);
    setStatus("Attachment uploaded.");
  };

  const sendMessage = async () => {
    if (!selectedPeerId || (!text.trim() && !attachment)) return;

    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        receiver_id: selectedPeerId,
        message: text,
        attachment_url: attachment?.url || null,
        attachment_name: attachment?.name || null,
        attachment_type: attachment?.type || null,
        attachment_size: attachment?.size || null,
        attachment_path: attachment?.path || null
      })
    });

    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error || "Failed to send message");
      return;
    }

    setMessages((prev) => [...prev, data.message]);
    setText("");
    setPeerTyping(false);
    setAttachment(null);
    setStatus("Message sent");
    await fetch("/api/messages/typing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiver_id: selectedPeerId, is_typing: false })
    });
  };

  const saveTemplate = async () => {
    if (!templateTitle.trim() || !templateBody.trim()) {
      setStatus("Template title and body are required.");
      return;
    }
    const res = await fetch("/api/messages/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: templateTitle, body: templateBody })
    });
    const payload = await res.json();
    if (!res.ok) {
      setStatus(payload.error || "Failed to save template");
      return;
    }
    setTemplates((prev) => [payload.template, ...prev]);
    setTemplateTitle("");
    setTemplateBody("");
    setStatus("Template saved.");
  };

  const deleteTemplate = async (id: string) => {
    const res = await fetch(`/api/messages/templates?id=${id}`, { method: "DELETE" });
    const payload = await res.json();
    if (!res.ok) {
      setStatus(payload.error || "Failed to delete template");
      return;
    }
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="grid gap-4 md:grid-cols-[300px_1fr]">
      <aside className="card space-y-2">
        <h3 className="font-semibold">Conversations</h3>
        {peers.map((peer) => (
          <button
            key={peer.id}
            className={`w-full rounded-xl px-3 py-2.5 text-left text-sm ${peer.id === selectedPeerId ? "bg-blue-50" : "hover:bg-slate-100"}`}
            onClick={() => setSelectedPeerId(peer.id)}
          >
            <p className="font-semibold text-slate-900">{peer.name}</p>
            <p className="text-xs text-slate-500">
              {peer.role} · {peer.email}
            </p>
            {(unreadByPeer[peer.id] || 0) > 0 && (
              <span className="mt-1 inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">{unreadByPeer[peer.id]} new</span>
            )}
          </button>
        ))}
      </aside>

      <section className="card flex h-[560px] flex-col">
        <div ref={messageListRef} className="flex-1 space-y-2 overflow-y-auto p-1">
          {messages.map((entry) => {
            const mine = entry.sender_id === currentUserId;
            const sentAt = new Date(entry.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
            const readAt = entry.read_at ? new Date(entry.read_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : null;
            return (
              <div key={entry.id} className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${mine ? "ml-auto bg-blue-600 text-white" : "bg-slate-100"}`}>
                <p>{entry.message}</p>
                {entry.attachment_url && (
                  <a href={entry.attachment_url} target="_blank" rel="noreferrer" className={`mt-1 block text-xs underline ${mine ? "text-blue-100" : "text-blue-700"}`}>
                    📎 {entry.attachment_name || "Attachment"}
                  </a>
                )}
                <p className={`mt-1 text-xs ${mine ? "text-blue-100" : "text-slate-500"}`}>
                  {mine ? (readAt ? `Read ${readAt}` : `Sent ${sentAt}`) : new Date(entry.created_at).toLocaleString()}
                </p>
              </div>
            );
          })}
          {peerTyping && (
            <div className="max-w-[80%] rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-600">
              Typing...
            </div>
          )}
        </div>

        {canUseTemplates && (
          <div className="mb-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Quick Templates</p>
            <div className="mb-2 flex flex-wrap gap-2">
              {templates.map((template) => (
                <div key={template.id} className="flex items-center gap-1">
                  <button className="btn-secondary" onClick={() => setText(template.body)}>
                    {template.title}
                  </button>
                  <button className="text-xs font-semibold text-rose-700" onClick={() => deleteTemplate(template.id)}>
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="grid gap-2 md:grid-cols-[1fr_2fr_auto]">
              <input className="input" placeholder="Template title" value={templateTitle} onChange={(e) => setTemplateTitle(e.target.value)} />
              <input className="input" placeholder="Template body" value={templateBody} onChange={(e) => setTemplateBody(e.target.value)} />
              <button className="btn-primary" onClick={saveTemplate}>
                Save
              </button>
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <input className="input flex-1" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type message" />
          <label className="btn-secondary cursor-pointer">
            {uploading ? "Uploading..." : "Attach"}
            <input
              type="file"
              className="hidden"
              accept="image/png,image/jpeg,image/webp,application/pdf,text/plain"
              onChange={(e) => e.target.files?.[0] && uploadAttachment(e.target.files[0])}
            />
          </label>
          <button className="btn-primary" onClick={sendMessage}>
            Send
          </button>
        </div>
        {attachment && <p className="mt-1 text-xs text-slate-600">Attached: {attachment.name}</p>}
        {status && <p className="mt-2 text-sm text-slate-700">{status}</p>}
      </section>
    </div>
  );
}
