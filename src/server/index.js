import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();

// If your Vite frontend runs on 5173, allow it
app.use(cors({ origin: ["http://localhost:5173"], credentials: false }));
app.use(express.json({ limit: "1mb" }));

app.post("/api/ai/chat", async (req, res) => {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing GROQ_API_KEY" });

    const prompt = String(req.body?.prompt ?? "").trim();
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    // Groq Chat Completions (OpenAI-compatible)
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: "You are a professional health and fitness coach." },
          { role: "user", content: prompt },
        ],
        temperature: 0.6,
        max_tokens: 512,
      }),
    });

    const data = await r.json();

    if (!r.ok) {
      return res.status(r.status).json({ error: data });
    }

    const text = data?.choices?.[0]?.message?.content ?? "";
    const tokensUsed = data?.usage?.total_tokens ?? 0;

    return res.json({ text, tokensUsed });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`));