export const HOARE_API = process.env.NEXT_PUBLIC_HOARE_API_URL;

async function hoareFetch(path: string, options?: RequestInit) {
  if (!HOARE_API) {
    throw new Error("NEXT_PUBLIC_HOARE_API_URL is not configured.");
  }
  const res = await fetch(`${HOARE_API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`HOARE API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function hoareChat(message: string) {
  return hoareFetch("/api/hoare/chat", {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export async function hoareExecute(toolName: string, payload: Record<string, unknown> = {}) {
  return hoareFetch("/api/hoare/execute", {
    method: "POST",
    body: JSON.stringify({ tool: toolName, ...payload }),
  });
}

export async function hoareListTools() {
  return hoareFetch("/api/hoare/tools");
}

export async function hoareSessionCreate(metadata?: Record<string, unknown>) {
  return hoareFetch("/api/hoare/session", {
    method: "POST",
    body: JSON.stringify(metadata ?? {}),
  });
}

export async function hoareSessionList() {
  return hoareFetch("/api/hoare/session");
}
