"use client";

import { useEffect, useState } from "react";

type Peer = { id: string; name: string; email: string; role: "admin" | "coach" | "client" };
type Message = { id: string; sender_id: string; receiver_id: string; message: string; created_at: string };

export function MessagingPanel({
  currentUserId,
  peers,
  initialMessages,
  initialSelectedPeerId
}: {
  currentUserId: string;
  peers: Peer[];
  initialMessages: Message[];
  initialSelectedPeerId?: string;
}) {
  const [selectedPeerId, setSelectedPeerId] = useState(initialSelectedPeerId || peers[0]?.id || "");
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const loadConversation = async (peerId: string) => {
    if (!peerId) return;
    const res = await fetch(`/api/messages?peer_id=${peerId}`);
    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error || "Could not load messages");
      return;
    }
    setMessages(data.messages);
  };

  useEffect(() => {
    if (selectedPeerId) {
      loadConversation(selectedPeerId);
    }
  }, [selectedPeerId]);

  const sendMessage = async () => {
    if (!selectedPeerId || !text.trim()) return;

    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiver_id: selectedPeerId, message: text })
    });

    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error || "Failed to send message");
      return;
    }

    setMessages((prev) => [...prev, data.message]);
    setText("");
    setStatus("Message sent");
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
          </button>
        ))}
      </aside>

      <section className="card flex h-[560px] flex-col">
        <div className="flex-1 space-y-2 overflow-y-auto p-1">
          {messages.map((entry) => {
            const mine = entry.sender_id === currentUserId;
            return (
              <div key={entry.id} className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${mine ? "ml-auto bg-blue-600 text-white" : "bg-slate-100"}`}>
                <p>{entry.message}</p>
                <p className={`mt-1 text-xs ${mine ? "text-blue-100" : "text-slate-500"}`}>{new Date(entry.created_at).toLocaleString()}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex gap-2">
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type message" />
          <button className="btn-primary" onClick={sendMessage}>
            Send
          </button>
        </div>
        {status && <p className="mt-2 text-sm text-slate-700">{status}</p>}
      </section>
    </div>
  );
}
