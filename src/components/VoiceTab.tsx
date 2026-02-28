import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generateCoachReply } from "../server/AiService";

type VoiceState = "idle" | "listening" | "processing" | "speaking";
type UiError = string | null;

function hasWebSpeech(): boolean {
  return typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
}
function getSpeechRecognitionCtor(): any {
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
}

function normalizeWebSpeechError(err: any) {
  const code = err?.error || err?.name || "unknown";
  if (code === "not-allowed" || code === "service-not-allowed") return "Microphone permission blocked. Allow mic for this site.";
  if (code === "audio-capture") return "Mic not found or already in use. Close other apps using mic.";
  if (code === "network") return "Speech service blocked (Brave sometimes). Try Chrome or enable permissions.";
  return `Mic/STT error: ${code}`;
}

/**
 * VoiceTab (FAST + STABLE)
 * - NO RunAnywhere STT/TTS model loading (no delays, no model API errors)
 * - Browser SpeechRecognition => transcript (instant)
 * - Grok API via generateCoachReply() => reply
 * - Browser speechSynthesis => speak reply
 * - Orb audio level via WebAudio analyser (only while listening)
 */
export function VoiceTab() {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<UiError>(null);

  // SpeechRecognition
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const finalTextRef = useRef("");

  // API abort
  const apiAbortRef = useRef<AbortController | null>(null);

  // WebAudio level meter
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const stopLevelMeter = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    try {
      audioCtxRef.current?.close?.();
    } catch {}
    audioCtxRef.current = null;

    try {
      streamRef.current?.getTracks?.().forEach((t) => t.stop());
    } catch {}
    streamRef.current = null;

    setAudioLevel(0);
  }, []);

  const startLevelMeter = useCallback(async () => {
    stopLevelMeter();

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx: AudioContext = new AudioCtx();
    audioCtxRef.current = ctx;

    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      if (!isListeningRef.current) return; // ✅ IMPORTANT: no updates when not listening

      analyser.getByteFrequencyData(data);

      // RMS-ish level (0..1)
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const avg = sum / data.length; // 0..255
      const level = Math.min(1, Math.max(0, avg / 180)); // normalize

      setAudioLevel(level);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [stopLevelMeter]);

  const stopAll = useCallback(() => {
    // Stop recognition
    try {
      const r = recognitionRef.current;
      if (r) {
        r.onresult = null;
        r.onerror = null;
        r.onend = null;
        r.stop?.();
      }
    } catch {}
    recognitionRef.current = null;

    // Stop listening flags
    isListeningRef.current = false;

    // Stop audio meter
    stopLevelMeter();

    // Cancel TTS
    try {
      window.speechSynthesis?.cancel?.();
    } catch {}

    // Abort API
    try {
      apiAbortRef.current?.abort();
    } catch {}

    setVoiceState("idle");
  }, [stopLevelMeter]);

  useEffect(() => {
    return () => stopAll();
  }, [stopAll]);

  const speak = useCallback(async (text: string) => {
    if (!("speechSynthesis" in window)) return;

    setVoiceState("speaking");
    await new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.0;
      u.pitch = 1.0;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    });
  }, []);

  const askAPI = useCallback(async (userText: string) => {
    apiAbortRef.current?.abort();
    const ac = new AbortController();
    apiAbortRef.current = ac;

    const prompt =
      "You are a helpful voice fitness assistant. Keep answers concise (1-2 sentences). " +
      "Avoid medical claims; suggest a professional if needed.\n\n" +
      `User said: ${userText}\nAssistant:`;

    const { text } = await generateCoachReply(prompt, ac.signal);
    return (text || "").trim() || "Okay. Tell me a bit more so I can help.";
  }, []);

  const processText = useCallback(
    async (text: string) => {
      const clean = (text || "").trim();
      setTranscript(clean);
      setResponse("");

      if (!clean) {
        setResponse("I didn’t catch that—please try again.");
        setVoiceState("idle");
        return;
      }

      setVoiceState("processing");
      try {
        const reply = await askAPI(clean);
        setResponse(reply);
        await speak(reply);
      } catch (e: any) {
        setError(e?.message || "Failed to get reply.");
      } finally {
        setVoiceState("idle");
      }
    },
    [askAPI, speak]
  );

  const startListening = useCallback(async () => {
    setError(null);
    setTranscript("");
    setResponse("");
    finalTextRef.current = "";

    if (!hasWebSpeech()) {
      setError("Browser SpeechRecognition not available. Use Chrome (HTTPS/localhost) and allow mic.");
      return;
    }

    // stop anything running
    stopAll();

    // Start audio level meter (fix orb jump only while listening)
    try {
      await startLevelMeter();
    } catch {
      setError("Mic permission not granted. Allow microphone and retry.");
      stopAll();
      return;
    }

    const Ctor = getSpeechRecognitionCtor();
    const r = new Ctor();
    recognitionRef.current = r;

    isListeningRef.current = true;
    setVoiceState("listening");

    r.continuous = false;
    r.interimResults = true;
    r.lang = "en-US";

    r.onresult = (event: any) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const t = res?.[0]?.transcript || "";
        if (res.isFinal) final += t;
        else interim += t;
      }

      finalTextRef.current = (finalTextRef.current + " " + final).trim();
      setTranscript((finalTextRef.current + " " + interim).trim());
    };

    r.onerror = (e: any) => {
      isListeningRef.current = false;
      stopLevelMeter();
      setVoiceState("idle");
      setError(normalizeWebSpeechError(e));
    };

    r.onend = async () => {
      // End of speech capture
      if (!isListeningRef.current) return;
      isListeningRef.current = false;

      // stop meter immediately to prevent orb auto up/down
      stopLevelMeter();

      const text = (finalTextRef.current || transcript || "").trim();
      await processText(text);
    };

    try {
      r.start();
    } catch {
      isListeningRef.current = false;
      stopLevelMeter();
      setVoiceState("idle");
      setError("Could not start speech recognition. Check mic permissions.");
    }
  }, [processText, startLevelMeter, stopAll, stopLevelMeter, transcript]);

  const engineLabel = useMemo(() => {
    if (voiceState === "listening") return "Listening";
    if (voiceState === "processing") return "Processing";
    if (voiceState === "speaking") return "Speaking";
    return "Ready";
  }, [voiceState]);

  return (
    <div className="tab-panel voice-panel">
      {error && (
        <div className="model-banner">
          <span className="error-text">{error}</span>
        </div>
      )}

      <div className="voice-center">
        <div
          className="voice-orb"
          data-state={voiceState}
          style={{ "--level": audioLevel } as React.CSSProperties}
        >
          <div className="voice-orb-inner" />
        </div>

        <p className="voice-status">
          {voiceState === "idle" && `Tap to start • Engine: ${engineLabel}`}
          {voiceState === "listening" && "Listening… speak now"}
          {voiceState === "processing" && "Processing…"}
          {voiceState === "speaking" && "Speaking…"}
        </p>

        {voiceState === "idle" ? (
          <button className="btn btn-primary btn-lg" onClick={startListening}>
            Start Listening
          </button>
        ) : (
          <button className="btn btn-lg" onClick={stopAll}>
            Stop
          </button>
        )}
      </div>

      {transcript && (
        <div className="voice-transcript">
          <h4>You said:</h4>
          <p>{transcript}</p>
        </div>
      )}

      {response && (
        <div className="voice-response">
          <h4>AI response:</h4>
          <p>{response}</p>
        </div>
      )}
    </div>
  );
}