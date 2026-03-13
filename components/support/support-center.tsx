"use client";

import { useEffect, useMemo, useState } from "react";
import type { Role } from "@/types/db";

type Ticket = {
  id: string;
  client_id: string;
  client_name: string;
  subject: string;
  category: "login" | "billing" | "contracts" | "technical" | "other";
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "normal" | "high" | "urgent";
  message: string;
  created_at: string;
  updated_at: string;
};

const categories = ["login", "billing", "contracts", "technical", "other"] as const;
const priorities = ["low", "normal", "high", "urgent"] as const;
const statuses = ["open", "in_progress", "resolved", "closed"] as const;

export function SupportCenter({ role }: { role: Role }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>("technical");
  const [priority, setPriority] = useState<(typeof priorities)[number]>("normal");
  const [message, setMessage] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(nextStatus?: string) {
    setLoading(true);
    const params = new URLSearchParams();
    if (nextStatus) params.set("status", nextStatus);
    const res = await fetch(`/api/support/tickets?${params.toString()}`, { cache: "no-store" });
    const payload = await res.json();
    if (!res.ok) {
      setStatus(payload.error || "Failed to load support tickets");
      setLoading(false);
      return;
    }
    setTickets(payload.tickets || []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const sorted = useMemo(
    () => [...tickets].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [tickets]
  );

  async function submitTicket(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    const res = await fetch("/api/support/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, category, priority, message })
    });
    const payload = await res.json();
    if (!res.ok) {
      setStatus(payload.error || "Failed to create support ticket");
      return;
    }
    setSubject("");
    setCategory("technical");
    setPriority("normal");
    setMessage("");
    setStatus("Support ticket created.");
    await load(selectedStatus || undefined);
  }

  async function setTicketStatus(ticketId: string, nextStatus: (typeof statuses)[number]) {
    const res = await fetch(`/api/support/tickets/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus })
    });
    const payload = await res.json();
    if (!res.ok) {
      setStatus(payload.error || "Failed to update ticket");
      return;
    }
    setStatus("Ticket updated.");
    await load(selectedStatus || undefined);
  }

  return (
    <div className="space-y-4">
      <form className="card grid gap-3 md:grid-cols-2" onSubmit={submitTicket}>
        <div className="md:col-span-2">
          <h2 className="text-lg font-semibold">Create Support Ticket</h2>
          <p className="text-sm text-slate-600">Use this for account, billing, contract, and technical assistance.</p>
        </div>

        <div>
          <label className="label">Subject</label>
          <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief ticket summary" />
        </div>
        <div>
          <label className="label">Category</label>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value as (typeof categories)[number])}>
            {categories.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Priority</label>
          <select className="input" value={priority} onChange={(e) => setPriority(e.target.value as (typeof priorities)[number])}>
            {priorities.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="label">Message</label>
          <textarea className="input min-h-28" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe the issue..." />
        </div>

        <div className="md:col-span-2">
          <button className="btn-primary" type="submit">
            Submit Ticket
          </button>
        </div>
      </form>

      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{role === "client" ? "My Support Tickets" : "Support Queue"}</h2>
          <div className="flex items-center gap-2">
            <label className="label m-0">Status</label>
            <select
              className="input w-44"
              value={selectedStatus}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedStatus(value);
                void load(value || undefined);
              }}
            >
              <option value="">All</option>
              {statuses.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading && <p className="text-sm text-slate-600">Loading tickets...</p>}
        {!loading && sorted.length === 0 && <p className="text-sm text-slate-600">No tickets found.</p>}

        <div className="space-y-2">
          {sorted.map((ticket) => (
            <div key={ticket.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-slate-900">{ticket.subject}</p>
                <p className="text-xs text-slate-500">{new Date(ticket.updated_at).toLocaleString()}</p>
              </div>
              <p className="mt-1 text-sm text-slate-700">{ticket.message}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-slate-200 px-2 py-0.5 font-semibold text-slate-700">{ticket.category}</span>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 font-semibold text-slate-700">{ticket.priority}</span>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-blue-700">{ticket.status}</span>
                {(role === "admin" || role === "coach") && (
                  <select
                    className="input ml-auto w-40 py-1 text-xs"
                    value={ticket.status}
                    onChange={(e) => void setTicketStatus(ticket.id, e.target.value as (typeof statuses)[number])}
                  >
                    {statuses.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {(role === "admin" || role === "coach") && (
                <p className="mt-1 text-xs text-slate-500">Client: {ticket.client_name}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {status && <p className="text-sm text-slate-700">{status}</p>}
    </div>
  );
}

