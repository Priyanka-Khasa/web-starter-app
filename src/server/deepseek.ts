import type { Request, Response } from "express";

export async function deepseekHandler(req: Request, res: Response) {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing DEEPSEEK_API_KEY on server" });
    }

    const { prompt } = req.body as { prompt?: string };
    if (!prompt?.trim()) {
      return res.status(400).json({ error: "Missing prompt" });
    }

    const r = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "You are a professional health and fitness coach." },
          { role: "user", content: prompt },
        ],
        temperature: 0.6,
      }),
    });

    const data = await r.json();

    if (!r.ok) {
      return res.status(r.status).json({ error: data });
    }

    const text: string = data?.choices?.[0]?.message?.content ?? "";
    const tokensUsed: number = data?.usage?.total_tokens ?? 0;

    return res.json({ text, tokensUsed });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? "Unknown error" });
  }
}