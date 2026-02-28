import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FilesetResolver,
  PoseLandmarker,
  type PoseLandmarkerResult,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

/** ✅ Add your posture images (same pattern like nutrition images) */
import p1 from "../assets/posture-image1.webp";
import p2 from "../assets/posture-image2.webp";
import p3 from "../assets/posture-image3.webp";
import p4 from "../assets/posture-image4.webp";
import p5 from "../assets/posture-image5.webp";

type Exercise = "standing" | "squat" | "pushup" | "plank";

type Feedback = {
  status: "correct" | "warning" | "bad" | "no_person";
  title: string;
  tips: string[];
  metrics?: Record<string, string>;

  /** ✅ numeric metrics for averaging in history */
  numeric?: Record<string, number>;
};

type PostureSession = {
  id: string;
  exercise: Exercise;
  startedAt: number;
  endedAt: number;
  durationSec: number;

  frames: number;
  correctFrames: number;
  warningFrames: number;
  badFrames: number;
  noPersonFrames: number;

  correctPct: number;
  warningPct: number;
  badPct: number;
  noPersonPct: number;

  avg?: Record<string, number>;
};

const MODEL_ASSET_PATH =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

const DEFAULT_FPS_TARGET = 30;

const HISTORY_KEY = "fitnesscoach:posture:history:v1";
const MAX_HISTORY = 50;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function angleABC(a: any, b: any, c: any) {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const magAB = Math.sqrt(ab.x * ab.x + ab.y * ab.y);
  const magCB = Math.sqrt(cb.x * cb.x + cb.y * cb.y);
  const cos = dot / (magAB * magCB + 1e-9);
  const ang = Math.acos(clamp(cos, -1, 1));
  return (ang * 180) / Math.PI;
}

function avg(a: number, b: number) {
  return (a + b) / 2;
}

function fmt(n: number, d = 0) {
  return Number.isFinite(n) ? n.toFixed(d) : "-";
}

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function loadHistory(): PostureSession[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PostureSession[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function saveHistory(list: PostureSession[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_HISTORY)));
}

function exerciseLabel(e: Exercise) {
  if (e === "standing") return "Standing posture";
  if (e === "squat") return "Squat";
  if (e === "pushup") return "Push-up";
  return "Plank";
}

function pickSide(landmarks: any[], idxL: number, idxR: number) {
  const L = landmarks[idxL];
  const R = landmarks[idxR];
  const vL = L?.visibility ?? 1;
  const vR = R?.visibility ?? 1;
  return vR > vL ? { side: "right" as const, p: R } : { side: "left" as const, p: L };
}

export function PostureTab() {
  const [exercise, setExercise] = useState<Exercise>("standing");
  const [cameraOn, setCameraOn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<Feedback>({
    status: "no_person",
    title: "Start camera to begin",
    tips: ["Keep your full body in frame."],
  });

  /** ✅ History UI */
  const [history, setHistory] = useState<PostureSession[]>(() => loadHistory());

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTSRef = useRef<number>(0);

  /** ✅ Session tracking (refs so it doesn’t rerender every frame) */
  const sessionActiveRef = useRef(false);
  const sessionStartRef = useRef<number>(0);
  const statsRef = useRef({
    frames: 0,
    correct: 0,
    warning: 0,
    bad: 0,
    noPerson: 0,
    sums: {} as Record<string, number>,
    counts: {} as Record<string, number>,
  });

  const resetSessionStats = useCallback(() => {
    statsRef.current = {
      frames: 0,
      correct: 0,
      warning: 0,
      bad: 0,
      noPerson: 0,
      sums: {},
      counts: {},
    };
  }, []);

  const startSession = useCallback(() => {
    sessionActiveRef.current = true;
    sessionStartRef.current = Date.now();
    resetSessionStats();
  }, [resetSessionStats]);

  const finishSessionAndSave = useCallback(
    (reason: "stop" | "auto" = "stop") => {
      if (!sessionActiveRef.current) return;

      const endedAt = Date.now();
      const startedAt = sessionStartRef.current || endedAt;
      const durationSec = Math.max(0, Math.round((endedAt - startedAt) / 1000));

      const s = statsRef.current;

      // Only save meaningful sessions (>= 5 seconds OR enough frames)
      const shouldSave = durationSec >= 5 || s.frames >= 120;
      sessionActiveRef.current = false;

      if (!shouldSave) return;

      const frames = Math.max(1, s.frames);
      const correctPct = (s.correct / frames) * 100;
      const warningPct = (s.warning / frames) * 100;
      const badPct = (s.bad / frames) * 100;
      const noPersonPct = (s.noPerson / frames) * 100;

      const avgNumeric: Record<string, number> = {};
      for (const k of Object.keys(s.sums)) {
        const c = s.counts[k] || 0;
        if (c > 0) avgNumeric[k] = s.sums[k] / c;
      }

      const entry: PostureSession = {
        id: uid("posture"),
        exercise,
        startedAt,
        endedAt,
        durationSec,
        frames: s.frames,
        correctFrames: s.correct,
        warningFrames: s.warning,
        badFrames: s.bad,
        noPersonFrames: s.noPerson,
        correctPct: Number(correctPct.toFixed(1)),
        warningPct: Number(warningPct.toFixed(1)),
        badPct: Number(badPct.toFixed(1)),
        noPersonPct: Number(noPersonPct.toFixed(1)),
        avg: Object.keys(avgNumeric).length ? avgNumeric : undefined,
      };

      setHistory((prev) => {
        const next = [entry, ...prev].slice(0, MAX_HISTORY);
        saveHistory(next);
        return next;
      });
    },
    [exercise]
  );

  const stopAll = useCallback(() => {
    // ✅ auto-save session on stop
    finishSessionAndSave("stop");

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    const v = videoRef.current;
    if (v && v.srcObject) {
      const tracks = (v.srcObject as MediaStream).getTracks();
      tracks.forEach((t) => t.stop());
      v.srcObject = null;
    }
    setCameraOn(false);
  }, [finishSessionAndSave]);

  /** init pose landmarker once */
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        setLoading(true);
        setErr(null);

        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_ASSET_PATH },
          runningMode: "VIDEO",
          numPoses: 1,
        });

        if (cancelled) return;
        landmarkerRef.current = landmarker;
        setLoading(false);
      } catch (e: any) {
        setErr(e?.message ?? String(e));
        setLoading(false);
      }
    }

    init();

    return () => {
      cancelled = true;
      stopAll();
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, [stopAll]);

  const startCamera = useCallback(async () => {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      const v = videoRef.current!;
      v.srcObject = stream;
      await v.play();

      setCameraOn(true);

      // ✅ start tracking session when camera begins
      startSession();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }, [startSession]);

  function ensureCanvasSize() {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;

    const vw = v.videoWidth || 1280;
    const vh = v.videoHeight || 720;

    if (c.width !== vw) c.width = vw;
    if (c.height !== vh) c.height = vh;
  }

  function makeFeedback(ex: Exercise, res: PoseLandmarkerResult): Feedback {
    const lm = res?.landmarks?.[0];
    if (!lm || lm.length < 33) {
      return {
        status: "no_person",
        title: "No person detected",
        tips: ["Move back a little", "Make sure lighting is good", "Keep full body visible"],
      };
    }

    const Ls = lm[11],
      Rs = lm[12];
    const Lh = lm[23],
      Rh = lm[24];
    const Lk = lm[25],
      Rk = lm[26];
    const La = lm[27],
      Ra = lm[28];
    const Le = lm[13],
      Re = lm[14];
    const Lw = lm[15],
      Rw = lm[16];

    const visAvg = avg(avg(Ls.visibility ?? 1, Rs.visibility ?? 1), avg(Lh.visibility ?? 1, Rh.visibility ?? 1));
    if (visAvg < 0.4) {
      return {
        status: "no_person",
        title: "Low visibility",
        tips: ["Stand in better light", "Keep whole body in frame"],
      };
    }

    const shoulderTilt = Math.abs((Ls.y ?? 0) - (Rs.y ?? 0));
    const hipTilt = Math.abs((Lh.y ?? 0) - (Rh.y ?? 0));

    const kneePick = pickSide(lm, 25, 26);
    const anklePick = pickSide(lm, 27, 28);
    const hipPick = pickSide(lm, 23, 24);
    const shoulderPick = pickSide(lm, 11, 12);
    const elbowPick = pickSide(lm, 13, 14);
    const wristPick = pickSide(lm, 15, 16);

    const hip = hipPick.p;
    const knee = kneePick.p;
    const ankle = anklePick.p;
    const shoulder = shoulderPick.p;
    const elbow = elbowPick.p;
    const wrist = wristPick.p;

    const kneeAngle = angleABC(hip, knee, ankle);
    const elbowAngle = angleABC(shoulder, elbow, wrist);
    const shoulderToHip = dist(shoulder, hip);
    const torsoAngle = angleABC(shoulder, hip, knee);

    const tips: string[] = [];

    const metrics: Record<string, string> = {
      "Shoulder tilt": fmt(shoulderTilt * 100, 1) + "%",
      "Hip tilt": fmt(hipTilt * 100, 1) + "%",
      "Knee angle": fmt(kneeAngle, 0) + "°",
      "Torso angle": fmt(torsoAngle, 0) + "°",
    };

    const numeric: Record<string, number> = {
      shoulderTilt,
      hipTilt,
      kneeAngle,
      torsoAngle,
      elbowAngle,
    };

    if (shoulderTilt > 0.03) tips.push("Level your shoulders (avoid leaning).");
    if (hipTilt > 0.03) tips.push("Level your hips (avoid shifting weight to one side).");

    if (ex === "standing") {
      if (torsoAngle < 155) tips.push("Stand taller: lift chest, brace core, avoid bending.");

      const status = tips.length === 0 ? "correct" : tips.length <= 2 ? "warning" : "bad";
      return {
        status,
        title: status === "correct" ? "Posture looks good" : "Adjust your posture",
        tips: tips.length ? tips : ["Nice! Keep core engaged and neck neutral."],
        metrics,
        numeric,
      };
    }

    if (ex === "squat") {
      const kneeOverToe = Math.abs((knee.x ?? 0) - (ankle.x ?? 0));
      metrics["Knee over toe"] = fmt(kneeOverToe * 100, 1) + "%";
      numeric.kneeOverToe = kneeOverToe;

      if (kneeAngle > 140) tips.push("Go lower: bend knees more for a proper squat.");
      if (kneeAngle < 55) tips.push("Too deep for now—control your depth and keep form stable.");
      if (torsoAngle < 135) tips.push("Chest up: reduce forward lean, brace your core.");
      if (kneeOverToe > 0.08) tips.push("Keep knee stacked over ankle (avoid drifting too far).");

      const status = tips.length === 0 ? "correct" : tips.length <= 2 ? "warning" : "bad";
      return {
        status,
        title: status === "correct" ? "Squat form looks solid" : "Fix squat form",
        tips: tips.length ? tips : ["Great! Keep heels grounded and knees tracking over toes."],
        metrics,
        numeric,
      };
    }

    if (ex === "pushup") {
      const bodyLine = angleABC(shoulder, hip, ankle);
      metrics["Body line"] = fmt(bodyLine, 0) + "°";
      metrics["Elbow angle"] = fmt(elbowAngle, 0) + "°";
      numeric.bodyLine = bodyLine;

      if (bodyLine < 160) tips.push("Keep body straight: tighten core, avoid sagging hips.");
      if (elbowAngle > 165) tips.push("Go lower: bend elbows more (controlled range).");
      if (elbowAngle < 55) tips.push("Too low—keep control and avoid collapsing.");
      if (shoulderToHip < 0.10) tips.push("Move slightly back so full upper body is visible.");

      const status = tips.length === 0 ? "correct" : tips.length <= 2 ? "warning" : "bad";
      return {
        status,
        title: status === "correct" ? "Push-up posture good" : "Fix push-up posture",
        tips: tips.length ? tips : ["Nice! Maintain a straight line and steady tempo."],
        metrics,
        numeric,
      };
    }

    if (ex === "plank") {
      const bodyLine = angleABC(shoulder, hip, ankle);
      metrics["Body line"] = fmt(bodyLine, 0) + "°";
      numeric.bodyLine = bodyLine;

      if (bodyLine < 165) tips.push("Straighten line: tuck pelvis slightly & brace core.");
      if (torsoAngle < 150) tips.push("Neck neutral: look down, avoid craning forward.");
      if (shoulderToHip < 0.10) tips.push("Step back so shoulders and hips are visible.");

      const status = tips.length === 0 ? "correct" : tips.length <= 2 ? "warning" : "bad";
      return {
        status,
        title: status === "correct" ? "Plank looks good" : "Fix plank posture",
        tips: tips.length ? tips : ["Great hold. Keep core tight and hips steady."],
        metrics,
        numeric,
      };
    }

    return { status: "warning", title: "Tracking", tips: ["Hold steady…"], metrics, numeric };
  }

  const loop = useCallback(() => {
    const v = videoRef.current;
    const c = canvasRef.current;
    const landmarker = landmarkerRef.current;
    if (!v || !c || !landmarker) return;

    const now = performance.now();
    const minDelta = 1000 / DEFAULT_FPS_TARGET;
    if (now - lastTSRef.current < minDelta) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }
    lastTSRef.current = now;

    ensureCanvasSize();

    const ctx = c.getContext("2d");
    if (!ctx) return;

    const res = landmarker.detectForVideo(v, now);

    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(v, 0, 0, c.width, c.height);

    const drawing = new DrawingUtils(ctx);
    const lm = res.landmarks?.[0];
    if (lm && lm.length) {
      drawing.drawLandmarks(lm, { radius: 3 });
      drawing.drawConnectors(lm, PoseLandmarker.POSE_CONNECTIONS);
    }

    // ✅ compute feedback + track stats
    const fb = makeFeedback(exercise, res);
    setFeedback(fb);

    // track frame stats for history
    const s = statsRef.current;
    s.frames += 1;

    if (fb.status === "correct") s.correct += 1;
    else if (fb.status === "warning") s.warning += 1;
    else if (fb.status === "bad") s.bad += 1;
    else s.noPerson += 1;

    if (fb.numeric) {
      for (const [k, val] of Object.entries(fb.numeric)) {
        if (!Number.isFinite(val)) continue;
        s.sums[k] = (s.sums[k] || 0) + val;
        s.counts[k] = (s.counts[k] || 0) + 1;
      }
    }

    rafRef.current = requestAnimationFrame(loop);
  }, [exercise]);

  useEffect(() => {
    if (!cameraOn) return;
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [cameraOn, loop]);

  const badge = useMemo(() => {
    if (feedback.status === "correct") return { text: "CORRECT", cls: "ok" };
    if (feedback.status === "warning") return { text: "ADJUST", cls: "warn" };
    if (feedback.status === "bad") return { text: "FIX NOW", cls: "bad" };
    return { text: "NO PERSON", cls: "none" };
  }, [feedback.status]);

  const exerciseCards = useMemo(
    () => [
      { id: "standing" as const, title: "Standing", img: p5 },
      { id: "squat" as const, title: "Squat", img: p4 },
      { id: "pushup" as const, title: "Push-up", img: p2 },
      { id: "plank" as const, title: "Plank", img: p1 },
      { id: "standing" as const, title: "Alignment", img: p3 }, // just for visual variety
    ],
    []
  );

  function deleteHistory(id: string) {
    setHistory((prev) => {
      const next = prev.filter((x) => x.id !== id);
      saveHistory(next);
      return next;
    });
  }

  function clearHistory() {
    setHistory([]);
    saveHistory([]);
  }

  function formatTime(ts: number) {
    const d = new Date(ts);
    return d.toLocaleString();
  }

  return (
    <div className="posture-pro">
      {/* Top */}
      <div className="pp-head">
        <div className="pp-headLeft">
          <div className="pp-badge">Posture</div>
          <h2>Real-time Posture Detection</h2>
          <p className="pp-muted">
            Accurate skeleton tracking (MediaPipe Pose). Best results when your whole body is visible.
          </p>

          {/* ✅ Exercise image strip */}
          <div className="pp-exerciseStrip">
            {exerciseCards.map((c, i) => {
              const active = c.id === exercise;
              return (
                <button
                  key={`${c.title}-${i}`}
                  className={`pp-exCard ${active ? "active" : ""}`}
                  type="button"
                  onClick={() => setExercise(c.id)}
                  title={c.title}
                >
                  <img src={c.img} alt={c.title} loading="lazy" />
                  <div className="pp-exName">{c.title}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="pp-controls">
          <label className="pp-field">
            <span>Exercise</span>
            <select value={exercise} onChange={(e) => setExercise(e.target.value as Exercise)}>
              <option value="standing">Standing posture</option>
              <option value="squat">Squat</option>
              <option value="pushup">Push-up</option>
              <option value="plank">Plank</option>
            </select>
          </label>

          {!cameraOn ? (
            <button className="pp-btn pp-primary" onClick={startCamera} disabled={loading}>
              {loading ? "Loading Pose Engine..." : "Start Camera"}
            </button>
          ) : (
            <button className="pp-btn pp-ghost" onClick={stopAll}>
              Stop & Save
            </button>
          )}
        </div>
      </div>

      {err && <div className="pp-error">Error: {err}</div>}

      {/* Main Grid */}
      <div className="pp-grid">
        {/* Camera */}
        <div className="pp-cam card">
          <div className="pp-cam-top">
            <span className={`pp-live ${badge.cls}`}>{badge.text}</span>
            <span className="pp-muted mini">Tip: Keep phone stable • Good lighting • Full body in frame</span>
          </div>

          <div className="pp-stage">
            <video ref={videoRef} className="pp-video" playsInline muted />
            <canvas ref={canvasRef} className="pp-canvas" />
          </div>
        </div>

        {/* Side */}
        <div className="pp-side">
          {/* Feedback */}
          <div className="card">
            <div className="pp-side-head">
              <h3>{feedback.title}</h3>
              <span className={`pp-pill ${badge.cls}`}>{badge.text}</span>
            </div>

            <div className="pp-tips">
              {feedback.tips.map((t, i) => (
                <div key={i} className="pp-tip">
                  <span className="dot" />
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Metrics */}
          <div className="card">
            <div className="pp-side-head">
              <h3>Live metrics</h3>
              <span className="pp-muted mini">Angles & alignment</span>
            </div>

            <div className="pp-metrics">
              {Object.entries(feedback.metrics || {}).map(([k, v]) => (
                <div key={k} className="pp-metric">
                  <span className="k">{k}</span>
                  <span className="v">{v}</span>
                </div>
              ))}
              {!feedback.metrics && <div className="pp-muted mini">Start camera to see live values.</div>}
            </div>
          </div>

          {/* ✅ History */}
          <div className="card">
            <div className="pp-side-head">
              <h3>Posture History</h3>
              <div className="pp-historyActions">
                <button className="pp-btn pp-ghost" onClick={clearHistory} disabled={history.length === 0}>
                  Clear
                </button>
              </div>
            </div>

            {history.length === 0 ? (
              <div className="pp-muted mini">No sessions yet. Start camera → Stop & Save.</div>
            ) : (
              <div className="pp-historyList">
                {history.slice(0, 10).map((h) => (
                  <div key={h.id} className="pp-historyItem">
                    <div className="pp-historyLeft">
                      <div className="pp-historyTitle">
                        <b>{exerciseLabel(h.exercise)}</b> • {h.durationSec}s
                      </div>
                      <div className="pp-muted mini">{formatTime(h.endedAt)}</div>

                      <div className="pp-historyStats mini">
                        ✅ {h.correctPct}% • ⚠️ {h.warningPct}% • ❌ {h.badPct}% • 👤 {h.noPersonPct}%
                      </div>

                      {h.avg && (
                        <div className="pp-historyAvg mini">
                          Avg:{" "}
                          {Object.entries(h.avg)
                            .slice(0, 3)
                            .map(([k, v]) => `${k}=${Number(v).toFixed(1)}`)
                            .join(" • ")}
                        </div>
                      )}
                    </div>

                    <button className="pp-iconBtn" onClick={() => deleteHistory(h.id)} title="Delete">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="card">
            <h3>What this supports</h3>
            <p className="pp-muted mini" style={{ marginTop: 8 }}>
              Designed for <b>standing, squat, push-up, plank</b> posture checks. “All exercises posture correction” is not
              realistic without a full exercise library and calibration.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}