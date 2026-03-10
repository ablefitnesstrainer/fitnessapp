type RecipientInput = {
  name: string;
  email: string;
  party: number;
};

type BreezedocRecipient = {
  id?: number;
  name?: string;
  email?: string;
  party?: number;
  sent_at?: string | null;
  opened_at?: string | null;
  completed_at?: string | null;
};

type BreezedocDocument = {
  id: number;
  slug?: string;
  title?: string;
  recipients?: BreezedocRecipient[];
};

function getToken() {
  const token = process.env.BREEZEDOC_API_TOKEN;
  if (!token) {
    throw new Error("Missing BREEZEDOC_API_TOKEN");
  }
  return token;
}

async function request(path: string, init?: RequestInit) {
  const token = getToken();
  const response = await fetch(`https://breezedoc.com/api${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {})
    },
    cache: "no-store"
  });

  const text = await response.text();
  let payload: any = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }

  if (!response.ok) {
    const message = payload?.message || payload?.error || `BreezeDoc API ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

export async function createDocumentFromTemplate(templateId: number) {
  const payload = await request(`/templates/${templateId}/create-document`, {
    method: "POST"
  });

  return payload as BreezedocDocument;
}

export async function sendDocument(documentId: number, recipients: RecipientInput[]) {
  const orderedRecipients = [...recipients]
    .sort((a, b) => a.party - b.party)
    .map((recipient) => ({ name: recipient.name, email: recipient.email }));

  const payload = await request(`/documents/${documentId}/send`, {
    method: "POST",
    body: JSON.stringify({ recipients: orderedRecipients })
  });

  return payload as BreezedocDocument;
}

export async function getDocument(documentId: number) {
  const payload = await request(`/documents/${documentId}`, { method: "GET" });
  return payload as BreezedocDocument;
}

export async function getDocumentRecipients(documentId: number) {
  const payload = await request(`/documents/${documentId}/recipients`, { method: "GET" });
  if (Array.isArray(payload?.data)) return payload.data as BreezedocRecipient[];
  if (Array.isArray(payload)) return payload as BreezedocRecipient[];
  return [] as BreezedocRecipient[];
}

export function deriveContractStatus(recipients: BreezedocRecipient[]) {
  if (!recipients.length) return "sent";

  const completedCount = recipients.filter((recipient) => Boolean(recipient.completed_at)).length;
  const openedCount = recipients.filter((recipient) => Boolean(recipient.opened_at)).length;
  const sentCount = recipients.filter((recipient) => Boolean(recipient.sent_at)).length;

  if (completedCount === recipients.length) return "completed";
  if (openedCount > 0) return "opened";
  if (sentCount > 0) return "sent";
  return "draft";
}
