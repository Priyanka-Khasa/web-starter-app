import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ModelBanner } from "./ModelBanner";
import { generateCoachReply } from "../server/AiService";
import { ModelCategory } from "@runanywhere/web";
import { useModelLoader } from "../hooks/useModelLoader";
import "../styles/health-coach.css";

interface Message {
  role: "user" | "assistant";
  text: string;
  stats?: { tokens: number; tokPerSec: number; latencyMs: number };
  createdAt?: number;
}

type ApiState = "ready" | "loading" | "error";

type ChatSession = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
};

const STORAGE_KEY = "fitnesscoach:chat:sessions:v2";

function now() {
  return Date.now();
}

function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

function clampTitle(s: string) {
  const t = s.trim().replace(/\s+/g, " ");
  return t.length > 40 ? t.slice(0, 40) + "…" : t || "New chat";
}

function buildPrompt(history: Message[], userText: string) {
  const last = history.slice(-10);
  const sys =
    "You are an expert Health & Fitness Coach. Give concise, actionable advice. " +
    "Use bullet points when helpful. No medical claims; suggest a professional when needed.\n\n";

  const convo = last
    .filter((m) => m.text?.trim())
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`)
    .join("\n");

  return `${sys}${convo}\nUser: ${userText}\nAssistant:`;
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadJson(filename: string, data: any) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function formatExportText(session: ChatSession) {
  const lines: string[] = [];
  lines.push(`AI Health Coach — Chat Export`);
  lines.push(`Title: ${session.title}`);
  lines.push(`Created: ${new Date(session.createdAt).toLocaleString()}`);
  lines.push(`Updated: ${new Date(session.updatedAt).toLocaleString()}`);
  lines.push(``);
  for (const m of session.messages) {
    const ts = m.createdAt ? new Date(m.createdAt).toLocaleString() : "";
    const who = m.role === "user" ? "User" : "Assistant";
    lines.push(`[${who}] ${ts}`);
    lines.push(m.text || "");
    lines.push(``);
  }
  return lines.join("\n");
}

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data as ChatSession[];
  } catch {
    return [];
  }
}

function saveSessions(sessions: ChatSession[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function ChatTab() {
  // RunAnywhere loader used only for status / readiness
  const onDevice = useModelLoader(ModelCategory.Language, {
    coexist: true,
    preferredModelId: "lfm2-350m-q4_k_m",
    pick: "preferred",
  } as any);

  const [apiState, setApiState] = useState<ApiState>("ready");
  const [apiError, setApiError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const [sessions, setSessions] = useState<ChatSession[]>(() => loadSessions());
  const [activeId, setActiveId] = useState<string>(() => loadSessions()[0]?.id ?? "");
  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeId) ?? null,
    [sessions, activeId]
  );
  const messages = activeSession?.messages ?? [];

  const [input, setInput] = useState("");

  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const assistantIndexRef = useRef<number | null>(null);
  const historySnapshotRef = useRef<Message[]>([]);
  const [showScrollDown, setShowScrollDown] = useState(false);

  // UI drawers (clean + responsive)
  const [systemOpen, setSystemOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (sessions.length === 0) {
      const id = uid();
      const s: ChatSession = {
        id,
        title: "New chat",
        createdAt: now(),
        updatedAt: now(),
        messages: [],
      };
      setSessions([s]);
      setActiveId(id);
      saveSessions([s]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => saveSessions(sessions), [sessions]);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => scrollToBottom(true), [messages.length, scrollToBottom]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const onScroll = () => {
      const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollDown(remaining > 220);
    };

    el.addEventListener("scroll", onScroll);
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  const quickPrompts = useMemo(
    () => [
      "Make a 20-min home workout plan (no equipment).",
      "Suggest a healthy vegetarian dinner under 400 calories.",
      "Create a 7-day habit plan for better sleep.",
      "I feel low energy—what should I change today?",
    ],
    []
  );

  const ensureActiveSession = useCallback(() => {
    if (activeSession) return activeSession;
    const id = uid();
    const s: ChatSession = {
      id,
      title: "New chat",
      createdAt: now(),
      updatedAt: now(),
      messages: [],
    };
    setSessions((prev) => [s, ...prev]);
    setActiveId(id);
    return s;
  }, [activeSession]);

  const updateActiveSessionMessages = useCallback(
    (updater: (prev: Message[]) => Message[]) => {
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== activeId) return s;
          const nextMsgs = updater(s.messages);
          const nextTitle =
            s.messages.length === 0 && nextMsgs.length > 0
              ? clampTitle(nextMsgs[0]?.text ?? s.title)
              : s.title;
          return { ...s, messages: nextMsgs, title: nextTitle, updatedAt: now() };
        })
      );
    },
    [activeId]
  );

  const newChat = useCallback(() => {
    const id = uid();
    const s: ChatSession = {
      id,
      title: "New chat",
      createdAt: now(),
      updatedAt: now(),
      messages: [],
    };
    setSessions((prev) => [s, ...prev]);
    setActiveId(id);
    setInput("");
    setHistoryOpen(false);
  }, []);

  const renameChat = useCallback(() => {
    const s = activeSession;
    if (!s) return;
    const name = window.prompt("Rename chat", s.title);
    if (!name) return;
    const title = clampTitle(name);
    setSessions((prev) => prev.map((x) => (x.id === s.id ? { ...x, title, updatedAt: now() } : x)));
  }, [activeSession]);

  const deleteChat = useCallback(() => {
    const s = activeSession;
    if (!s) return;
    const ok = window.confirm(`Delete "${s.title}"?`);
    if (!ok) return;

    setSessions((prev) => {
      const next = prev.filter((x) => x.id !== s.id);
      const nextActive = next[0]?.id ?? "";
      setActiveId(nextActive);
      return next.length ? next : prev;
    });
    setHistoryOpen(false);
  }, [activeSession]);

  const exportTxt = useCallback(() => {
    const s = activeSession;
    if (!s) return;
    downloadText(`ai-health-coach-${s.id}.txt`, formatExportText(s));
  }, [activeSession]);

  const exportJson = useCallback(() => {
    const s = activeSession;
    if (!s) return;
    downloadJson(`ai-health-coach-${s.id}.json`, s);
  }, [activeSession]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    assistantIndexRef.current = null;
    setGenerating(false);
    setApiState("ready");
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || generating) return;

    ensureActiveSession();

    setInput("");
    setGenerating(true);
    setApiError(null);
    setApiState("loading");

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    updateActiveSessionMessages((prev) => {
      const userMsg: Message = { role: "user", text, createdAt: now() };
      const assistantMsg: Message = { role: "assistant", text: "", createdAt: now() };
      const next = [...prev, userMsg, assistantMsg];

      assistantIndexRef.current = next.length - 1;
      historySnapshotRef.current = [...prev, userMsg];

      return next;
    });

    await Promise.resolve();
    const t0 = performance.now();

    try {
      const prompt = buildPrompt(historySnapshotRef.current, text);
      const { text: replyText, tokensUsed } = await generateCoachReply(prompt, abortRef.current.signal);

      const latencyMs = Math.max(0, performance.now() - t0);
      const secs = Math.max(0.001, latencyMs / 1000);
      const tokPerSec = tokensUsed > 0 ? tokensUsed / secs : 0;

      const idx = assistantIndexRef.current;

      updateActiveSessionMessages((prev) => {
        if (idx == null || !prev[idx]) return prev;
        const next = [...prev];
        next[idx] = {
          role: "assistant",
          text: replyText || "No response.",
          createdAt: prev[idx].createdAt ?? now(),
          stats: { tokens: tokensUsed ?? 0, tokPerSec, latencyMs },
        };
        return next;
      });

      setApiState("ready");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setApiState("ready");
        return;
      }

      const msg = err instanceof Error ? err.message : String(err);
      const idx = assistantIndexRef.current;

      updateActiveSessionMessages((prev) => {
        if (idx == null || !prev[idx]) return prev;
        const next = [...prev];
        next[idx] = { role: "assistant", text: `Error: ${msg}`, createdAt: prev[idx].createdAt ?? now() };
        return next;
      });

      setApiState("error");
      setApiError(msg);
    } finally {
      abortRef.current = null;
      assistantIndexRef.current = null;
      setGenerating(false);
    }
  }, [input, generating, ensureActiveSession, updateActiveSessionMessages]);

  const inferenceLabel = apiState === "ready" ? "Live" : apiState === "loading" ? "Thinking…" : "Error";

  return (
    <div className="hc2">
      {/* Topbar (minimal, no provider names) */}
      <header className="hc2-topbar">
        <div className="hc2-titlewrap">
          <div className="hc2-title">AI Health Coach</div>
          <div className="hc2-sub">
            <span className={`hc2-pill ${apiState === "error" ? "bad" : apiState === "loading" ? "warn" : "ok"}`}>
              Inference: {inferenceLabel}
            </span>
            <span className={`hc2-pill ${onDevice.state === "error" ? "bad" : onDevice.state === "loading" ? "warn" : "ok"}`}>
              Engine: {onDevice.state === "ready" ? "Ready" : onDevice.state === "loading" ? "Loading" : onDevice.state === "error" ? "Error" : "Idle"}
            </span>
          </div>
        </div>

        <div className="hc2-actions">
          <button type="button" className="hc-btn hc-btn-ghost" onClick={() => setHistoryOpen(true)}>
            History
          </button>
          <button type="button" className="hc-btn hc-btn-ghost" onClick={() => setSystemOpen((v) => !v)}>
            System
          </button>
          <button
            type="button"
            className="hc-btn hc-btn-ghost"
            onClick={() => updateActiveSessionMessages(() => [])}
            disabled={generating || messages.length === 0}
            title="Clear chat"
          >
            Clear
          </button>
        </div>
      </header>

      {/* System drawer (collapsible, keeps UI clean) */}
      {systemOpen && (
        <section className="hc2-drawer">
          <div className="hc2-drawer-grid">
            <div className="hc2-card">
              <div className="hc2-card-title">RunAnywhere Engine</div>
              <ModelBanner
                state={onDevice.state as any}
                progress={(onDevice as any).progress ?? 0}
                error={(onDevice as any).error ?? null}
                onLoad={onDevice.ensure}
                label="On-device Model"
              />
              <div className="hc2-note">
                Loads local model for readiness (hybrid/offline). Responses can still be served by the API path.
              </div>
            </div>

            <div className="hc2-card">
              <div className="hc2-card-title">Inference Service</div>
              <ModelBanner
                state={apiState === "ready" ? "ready" : apiState === "loading" ? "loading" : "error"}
                progress={apiState === "loading" ? 0.7 : 0}
                error={apiError}
                onLoad={() => {
                  setApiError(null);
                  setApiState("ready");
                }}
                label="Chat Endpoint"
              />
              <div className="hc2-note">Fast replies + token stats per message.</div>
            </div>
          </div>
        </section>
      )}

      {/* Main layout */}
      <div className="hc2-body">
        {/* Quick prompts (compact, wraps well) */}
        <div className="hc2-quick">
          {quickPrompts.map((p) => (
            <button key={p} type="button" className="hc-chip" onClick={() => setInput(p)} disabled={generating}>
              {p}
            </button>
          ))}
        </div>

        {/* Messages */}
        <div className="hc2-messages" ref={listRef}>
          {messages.length === 0 && (
            <div className="hc-empty">
              <div className="hc-empty-title">Your coach is ready</div>
              <div className="hc-empty-text">Try: “Build me a weekly workout + vegetarian diet plan for weight loss.”</div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`hc-msg hc-msg-${msg.role}`}>
              <div className="hc-bubble">
                <div className="hc-bubble-text">{msg.text || "..."}</div>
                {msg.stats && (
                  <div className="hc-stats">
                    <span>{msg.stats.tokens} tokens</span>
                    <span>•</span>
                    <span>{(msg.stats.tokPerSec || 0).toFixed(1)} tok/s</span>
                    <span>•</span>
                    <span>{(msg.stats.latencyMs || 0).toFixed(0)} ms</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {showScrollDown && (
            <button type="button" className="hc-scrolldown" onClick={() => scrollToBottom(true)}>
              Scroll to latest
            </button>
          )}
        </div>

        {/* Inputbar */}
        <form
          className="hc2-inputbar"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <div className="hc2-inputwrap">
            <input
              className="hc-input"
              type="text"
              placeholder="Ask your health coach… (workout / diet / sleep / habits)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={generating}
            />
          </div>

          {generating ? (
            <button type="button" className="hc-btn hc-btn-warn" onClick={handleCancel}>
              Stop
            </button>
          ) : (
            <button type="submit" className="hc-btn hc-btn-primary" disabled={!input.trim()}>
              Send
            </button>
          )}
        </form>

        <div className="hc-footer-note">Not medical advice. For symptoms or emergencies, contact a professional.</div>
      </div>

      {/* History drawer (overlay) */}
      {historyOpen && (
        <div className="hc2-overlay" role="dialog" aria-modal="true">
          <div className="hc2-sheet">
            <div className="hc2-sheet-top">
              <div className="hc2-sheet-title">History</div>
              <div className="hc2-sheet-actions">
                <button type="button" className="hc-btn hc-btn-ghost" onClick={newChat}>
                  New
                </button>
                <button type="button" className="hc-btn hc-btn-ghost" onClick={renameChat} disabled={!activeSession}>
                  Rename
                </button>
                <button type="button" className="hc-btn hc-btn-ghost" onClick={deleteChat} disabled={!activeSession}>
                  Delete
                </button>
                <button type="button" className="hc-btn hc-btn-ghost" onClick={() => setHistoryOpen(false)}>
                  Close
                </button>
              </div>
            </div>

            <div className="hc2-sheet-list">
              {sessions
                .slice()
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`hc2-sheet-item ${s.id === activeId ? "active" : ""}`}
                    onClick={() => {
                      setActiveId(s.id);
                      setHistoryOpen(false);
                    }}
                  >
                    <div className="hc2-sheet-item-title">{s.title}</div>
                    <div className="hc2-sheet-item-meta">{new Date(s.updatedAt).toLocaleString()}</div>
                  </button>
                ))}
            </div>

            <div className="hc2-sheet-bottom">
              <button type="button" className="hc-btn hc-btn-ghost" onClick={exportTxt} disabled={!activeSession || messages.length === 0}>
                Export TXT
              </button>
              <button type="button" className="hc-btn hc-btn-ghost" onClick={exportJson} disabled={!activeSession || messages.length === 0}>
                Export JSON
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}