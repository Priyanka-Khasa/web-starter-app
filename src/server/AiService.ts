export type AiReply = {
  text: string;
  tokensUsed: number;
};

export async function generateCoachReply(prompt: string, signal?: AbortSignal): Promise<AiReply> {
  const r = await fetch("http://localhost:8787/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
    signal,
  });

  if (!r.ok) {
    let msg = `Request failed (${r.status})`;
    try {
      const data = await r.json();
      msg = data?.error ? JSON.stringify(data.error) : JSON.stringify(data);
    } catch {
      const txt = await r.text();
      if (txt) msg = txt;
    }
    throw new Error(msg);
  }

  const data = await r.json();
  return {
    text: String(data?.text ?? ""),
    tokensUsed: Number(data?.tokensUsed ?? 0),
  };
}