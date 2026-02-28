import React, { useEffect, useMemo, useRef, useState } from "react";

// ✅ HERO collage images (top section)
import hero1 from "../assets/workout-image1.webp";
import hero2 from "../assets/workout-image2.webp";
import hero3 from "../assets/workout-image3.webp";
import hero4 from "../assets/workout-image4.webp";

// ✅ Extra thumbnails (library variety)
import thumb5 from "../assets/workout-image5.webp";
import thumb6 from "../assets/workout-image6.webp";
import thumb7 from "../assets/workout-image7.webp";
import thumb8 from "../assets/workout-image8.webp";
import thumb9 from "../assets/workout-image9.webp";
import thumb10 from "../assets/workout-image10.webp";

/**
 * WorkoutsTab (Beginner-first Premium)
 * - Guided hero + quick start
 * - Category tiles with images
 * - Compact filter bar (no dense filters panel)
 * - Workout cards with thumbnails
 * - Drawer for details
 * - Session screen (clean)
 * - Weekly plan + history preserved
 */

type Difficulty = "Beginner" | "Intermediate" | "Advanced";
type Category = "Strength" | "Cardio" | "Mobility" | "Core" | "HIIT";
type Equipment = "None" | "Dumbbells" | "Resistance Band" | "Gym";

type WorkoutStep = {
  id: string;
  title: string;
  type: "work" | "rest";
  durationSec?: number;
  sets?: number;
  reps?: string;
  restSec?: number;
  notes?: string;
};

type Workout = {
  id: string;
  title: string;
  category: Category;
  difficulty: Difficulty;
  durationMin: number;
  equipment: Equipment;
  estCalories: number;
  description: string;
  tags: string[];
  steps: WorkoutStep[];
};

type SessionState = {
  activeWorkoutId: string;
  startedAt: number;
  paused: boolean;
  currentStepIndex: number;
  currentSet: number;
  remainingSec: number;
  notes: string;
};

type CompletedSession = {
  id: string;
  workoutId: string;
  workoutTitle: string;
  completedAt: number;
  totalSeconds: number;
  estCalories: number;
  notes: string;
};

type WeeklyPlan = {
  id: string;
  createdAt: number;
  days: Array<{
    day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
    workoutId: string;
  }>;
};

type Persisted = {
  history: CompletedSession[];
  weeklyPlan: WeeklyPlan | null;
  session: SessionState | null;
};

const STORAGE_KEY = "fitnesscoach:workouts:v4";

/* -------------------------------------------------------------------------- */
/*                                   helpers                                  */
/* -------------------------------------------------------------------------- */

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function fmtTime(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}
function fmtDate(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function loadPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error("no");
    const parsed = JSON.parse(raw) as Persisted;
    return {
      history: Array.isArray(parsed.history) ? parsed.history : [],
      weeklyPlan: parsed.weeklyPlan ?? null,
      session: parsed.session ?? null,
    };
  } catch {
    return { history: [], weeklyPlan: null, session: null };
  }
}
function savePersisted(p: Persisted) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

/* -------------------------------------------------------------------------- */
/*                                   images                                   */
/* -------------------------------------------------------------------------- */

const HERO = { a: hero1, b: hero2, c: hero3, d: hero4 };

const CATEGORY_THUMBS: Record<Category, string[]> = {
  Strength: [thumb7, thumb10, HERO.a],
  Cardio: [thumb8, thumb9, HERO.b],
  Mobility: [thumb6, HERO.c],
  Core: [thumb5, HERO.d],
  HIIT: [thumb8, HERO.d, HERO.b],
};

function pickThumb(category: Category, seed: string) {
  const pool = CATEGORY_THUMBS[category] ?? [HERO.a];
  const hash = seed.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return pool[hash % pool.length];
}

function thumbForWorkout(w: Pick<Workout, "id" | "category">) {
  return pickThumb(w.category, w.id);
}

/* -------------------------------------------------------------------------- */
/*                               category tiles                               */
/* -------------------------------------------------------------------------- */

const CATEGORY_TILES: Array<{
  key: Category | "Quick";
  title: string;
  sub: string;
  img: string;
  set: Partial<{ category: Category; difficulty: Difficulty; maxDuration: number }>;
}> = [
  {
    key: "Quick",
    title: "Quick Start",
    sub: "15–20 min • beginner-friendly",
    img: HERO.d,
    set: { difficulty: "Beginner", maxDuration: 20 },
  },
  {
    key: "Strength",
    title: "Strength",
    sub: "Build muscle & power",
    img: HERO.a,
    set: { category: "Strength" },
  },
  {
    key: "Cardio",
    title: "Cardio",
    sub: "Endurance & heart health",
    img: HERO.b,
    set: { category: "Cardio" },
  },
  {
    key: "Mobility",
    title: "Mobility",
    sub: "Recovery & flexibility",
    img: HERO.c,
    set: { category: "Mobility", difficulty: "Beginner" },
  },
  {
    key: "Core",
    title: "Core",
    sub: "Stability & posture",
    img: thumb5,
    set: { category: "Core", difficulty: "Beginner" },
  },
  {
    key: "HIIT",
    title: "HIIT",
    sub: "Fast conditioning",
    img: thumb8,
    set: { category: "HIIT" },
  },
];

/* -------------------------------------------------------------------------- */
/*                                  workouts                                  */
/* -------------------------------------------------------------------------- */

const WORKOUTS: Workout[] = [
  {
    id: "hiit_full_body_20",
    title: "Full Body HIIT",
    category: "HIIT",
    difficulty: "Intermediate",
    durationMin: 20,
    equipment: "None",
    estCalories: 220,
    description: "A time-based HIIT session designed to improve conditioning and full-body work capacity.",
    tags: ["fat loss", "conditioning", "full body"],
    steps: [
      { id: "w1", title: "Warm-up (dynamic)", type: "work", durationSec: 180, notes: "Light movement, joint prep." },
      { id: "w2", title: "Jumping jacks", type: "work", durationSec: 40 },
      { id: "r2", title: "Rest", type: "rest", durationSec: 20 },
      { id: "w3", title: "Bodyweight squats", type: "work", durationSec: 40 },
      { id: "r3", title: "Rest", type: "rest", durationSec: 20 },
      { id: "w4", title: "Push-ups (modified if needed)", type: "work", durationSec: 40 },
      { id: "r4", title: "Rest", type: "rest", durationSec: 20 },
      { id: "w5", title: "Mountain climbers", type: "work", durationSec: 40 },
      { id: "r5", title: "Rest", type: "rest", durationSec: 20 },
      { id: "w6", title: "Plank hold", type: "work", durationSec: 40 },
      { id: "r6", title: "Rest", type: "rest", durationSec: 20 },
      { id: "w7", title: "Cool-down (breathing + stretch)", type: "work", durationSec: 180 },
    ],
  },
  {
    id: "upper_power_45",
    title: "Upper Body Power",
    category: "Strength",
    difficulty: "Intermediate",
    durationMin: 45,
    equipment: "Dumbbells",
    estCalories: 280,
    description: "Strength-focused upper body workout emphasizing progressive overload with controlled volume.",
    tags: ["strength", "upper body", "push/pull"],
    steps: [
      { id: "wu", title: "Warm-up (band + mobility)", type: "work", durationSec: 300 },
      { id: "s1", title: "Dumbbell bench press", type: "work", sets: 4, reps: "8-12", restSec: 75 },
      { id: "s2", title: "One-arm dumbbell row", type: "work", sets: 4, reps: "8-12/side", restSec: 75 },
      { id: "s3", title: "Overhead press", type: "work", sets: 3, reps: "8-10", restSec: 75 },
      { id: "s4", title: "Lateral raise", type: "work", sets: 3, reps: "12-15", restSec: 60 },
      { id: "s5", title: "Biceps curls", type: "work", sets: 3, reps: "10-12", restSec: 60 },
      { id: "s6", title: "Triceps extensions", type: "work", sets: 3, reps: "10-12", restSec: 60 },
      { id: "cd", title: "Cool-down (stretch)", type: "work", durationSec: 240 },
    ],
  },
  {
    id: "core_15",
    title: "Core Stability",
    category: "Core",
    difficulty: "Beginner",
    durationMin: 15,
    equipment: "None",
    estCalories: 90,
    description: "Core stability series focusing on anti-extension and controlled breathing.",
    tags: ["core", "stability", "posture"],
    steps: [
      { id: "w1", title: "Warm-up (cat-cow + breathing)", type: "work", durationSec: 120 },
      { id: "w2", title: "Dead bug", type: "work", sets: 3, reps: "8-10/side", restSec: 40 },
      { id: "w3", title: "Side plank", type: "work", sets: 2, reps: "20-30s/side", restSec: 45 },
      { id: "w4", title: "Glute bridge", type: "work", sets: 3, reps: "10-12", restSec: 45 },
      { id: "w5", title: "Bird dog", type: "work", sets: 2, reps: "8-10/side", restSec: 45 },
      { id: "cd", title: "Cool-down (stretch)", type: "work", durationSec: 120 },
    ],
  },
  {
    id: "yoga_30",
    title: "Mobility Flow",
    category: "Mobility",
    difficulty: "Beginner",
    durationMin: 30,
    equipment: "None",
    estCalories: 120,
    description: "Mobility-focused flow to reduce stiffness and improve range of motion.",
    tags: ["mobility", "recovery", "flexibility"],
    steps: [
      { id: "w1", title: "Neck + shoulder mobility", type: "work", durationSec: 240 },
      { id: "w2", title: "Hip opener flow", type: "work", durationSec: 420 },
      { id: "w3", title: "Thoracic rotations", type: "work", durationSec: 240 },
      { id: "w4", title: "Hamstring + calf stretch", type: "work", durationSec: 300 },
      { id: "w5", title: "Breathing (box breathing)", type: "work", durationSec: 180 },
    ],
  },
  {
    id: "leg_day_50",
    title: "Lower Body Strength",
    category: "Strength",
    difficulty: "Advanced",
    durationMin: 50,
    equipment: "Gym",
    estCalories: 360,
    description: "Lower-body session emphasizing strength and hypertrophy with structured rest and volume.",
    tags: ["legs", "strength", "hypertrophy"],
    steps: [
      { id: "wu", title: "Warm-up (bike + mobility)", type: "work", durationSec: 420 },
      { id: "s1", title: "Squat (barbell or goblet)", type: "work", sets: 5, reps: "5-8", restSec: 120 },
      { id: "s2", title: "Romanian deadlift", type: "work", sets: 4, reps: "8-10", restSec: 120 },
      { id: "s3", title: "Split squat", type: "work", sets: 3, reps: "8-10/side", restSec: 90 },
      { id: "s4", title: "Leg curl", type: "work", sets: 3, reps: "10-12", restSec: 75 },
      { id: "s5", title: "Calf raise", type: "work", sets: 4, reps: "12-15", restSec: 60 },
      { id: "cd", title: "Cool-down (stretch)", type: "work", durationSec: 240 },
    ],
  },
  {
    id: "cardio_zone2_30",
    title: "Zone 2 Cardio",
    category: "Cardio",
    difficulty: "Beginner",
    durationMin: 30,
    equipment: "None",
    estCalories: 180,
    description: "Low-to-moderate steady-state cardio for endurance and recovery.",
    tags: ["cardio", "endurance", "recovery"],
    steps: [
      { id: "w1", title: "Warm-up walk", type: "work", durationSec: 300 },
      { id: "w2", title: "Steady pace (talk test)", type: "work", durationSec: 1200 },
      { id: "w3", title: "Cool-down walk", type: "work", durationSec: 300 },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/*                                  component                                 */
/* -------------------------------------------------------------------------- */

export function WorkoutsTab() {
  const [persisted, setPersisted] = useState<Persisted>(() => loadPersisted());

  // filters
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category | "All">("All");
  const [difficulty, setDifficulty] = useState<Difficulty | "All">("All");
  const [equipment, setEquipment] = useState<Equipment | "All">("All");
  const [maxDuration, setMaxDuration] = useState<number>(60);

  // tabs + drawer
  const [tab, setTab] = useState<"library" | "plan" | "history">("library");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // session
  const [session, setSession] = useState<SessionState | null>(() => persisted.session);
  const tickRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(Date.now());

  // persist
  useEffect(() => {
    savePersisted({ ...persisted, session });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persisted, session]);

  const selectedWorkout = useMemo(() => {
    const id = selectedId ?? session?.activeWorkoutId ?? null;
    if (!id) return null;
    return WORKOUTS.find((w) => w.id === id) || null;
  }, [selectedId, session?.activeWorkoutId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return WORKOUTS.filter((w) => {
      if (category !== "All" && w.category !== category) return false;
      if (difficulty !== "All" && w.difficulty !== difficulty) return false;
      if (equipment !== "All" && w.equipment !== equipment) return false;
      if (w.durationMin > maxDuration) return false;

      if (!q) return true;
      const hay = `${w.title} ${w.description} ${w.tags.join(" ")}`.toLowerCase();
      return hay.includes(q);
    }).sort((a, b) => a.durationMin - b.durationMin);
  }, [search, category, difficulty, equipment, maxDuration]);

  const recommended = useMemo(() => {
    return WORKOUTS.slice()
      .filter((w) => w.difficulty === "Beginner")
      .sort((a, b) => a.durationMin - b.durationMin)
      .slice(0, 3);
  }, []);

  /* -------------------------------- actions -------------------------------- */

  function openDrawer(id: string) {
    setSelectedId(id);
    setDrawerOpen(true);
  }
  function closeDrawer() {
    setDrawerOpen(false);
  }

  function applyTile(t: typeof CATEGORY_TILES[number]) {
    setTab("library");
    setSearch("");
    setCategory(t.set.category ?? "All");
    setDifficulty(t.set.difficulty ?? "All");
    setEquipment("All");
    setMaxDuration(t.set.maxDuration ?? 60);
  }

  function generateWeeklyPlan() {
    const pick = (id: string) => id;
    const days: WeeklyPlan["days"] = [
      { day: "Mon", workoutId: pick("upper_power_45") },
      { day: "Tue", workoutId: pick("cardio_zone2_30") },
      { day: "Wed", workoutId: pick("core_15") },
      { day: "Thu", workoutId: pick("yoga_30") },
      { day: "Fri", workoutId: pick("leg_day_50") },
      { day: "Sat", workoutId: pick("hiit_full_body_20") },
      { day: "Sun", workoutId: pick("cardio_zone2_30") },
    ];
    setPersisted((p) => ({ ...p, weeklyPlan: { id: uid("plan"), createdAt: Date.now(), days } }));
    setTab("plan");
  }

  function clearPlan() {
    setPersisted((p) => ({ ...p, weeklyPlan: null }));
  }

  function startWorkout(workoutId: string) {
    const w = WORKOUTS.find((x) => x.id === workoutId);
    if (!w) return;

    const first = w.steps[0];
    const remainingSec = first.durationSec ?? (first.restSec ?? 0);

    const s: SessionState = {
      activeWorkoutId: workoutId,
      startedAt: Date.now(),
      paused: false,
      currentStepIndex: 0,
      currentSet: 1,
      remainingSec: remainingSec || 0,
      notes: "",
    };

    setSession(s);
    setDrawerOpen(false);
    setSelectedId(workoutId);
    setTab("library");
  }

  function setPaused(paused: boolean) {
    setSession((s) => (s ? { ...s, paused } : s));
  }

  function stopTimer() {
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = null;
  }

  function ensureTimer() {
    if (tickRef.current) return;
    lastTickRef.current = Date.now();
    tickRef.current = window.setInterval(() => {
      setSession((prev) => {
        if (!prev || prev.paused) return prev;

        const w = WORKOUTS.find((x) => x.id === prev.activeWorkoutId);
        if (!w) return prev;

        const now = Date.now();
        const deltaSec = Math.max(0, Math.floor((now - lastTickRef.current) / 1000));
        if (deltaSec <= 0) return prev;
        lastTickRef.current = now;

        const currentStep = w.steps[prev.currentStepIndex];
        if (!currentStep) return prev;

        const isTimed = typeof currentStep.durationSec === "number";
        if (!isTimed) return prev;

        const nextRemain = prev.remainingSec - deltaSec;
        if (nextRemain > 0) return { ...prev, remainingSec: nextRemain };

        return advanceStep(prev, w, true);
      });
    }, 250);
  }

  useEffect(() => {
    if (session && !session.paused) ensureTimer();
    else stopTimer();
    return () => stopTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.paused, session?.activeWorkoutId]);

  function advanceStep(prev: SessionState, w: Workout, fromTimer = false): SessionState {
    const step = w.steps[prev.currentStepIndex];
    if (!step) return prev;

    // strength steps: timer shouldn’t auto-advance
    if (step.sets && step.sets > 0 && fromTimer) return prev;

    const nextIndex = clamp(prev.currentStepIndex + 1, 0, w.steps.length);
    if (nextIndex >= w.steps.length) {
      finishSession(prev, w);
      return prev;
    }

    const nextStep = w.steps[nextIndex];
    return {
      ...prev,
      currentStepIndex: nextIndex,
      currentSet: 1,
      remainingSec: nextStep.durationSec ?? 0,
    };
  }

  function prevStep() {
    setSession((prev) => {
      if (!prev) return prev;
      const w = WORKOUTS.find((x) => x.id === prev.activeWorkoutId);
      if (!w) return prev;
      const nextIndex = clamp(prev.currentStepIndex - 1, 0, w.steps.length - 1);
      const step = w.steps[nextIndex];
      return { ...prev, currentStepIndex: nextIndex, currentSet: 1, remainingSec: step.durationSec ?? 0 };
    });
  }

  function nextStep() {
    setSession((prev) => {
      if (!prev) return prev;
      const w = WORKOUTS.find((x) => x.id === prev.activeWorkoutId);
      if (!w) return prev;
      return advanceStep(prev, w, false);
    });
  }

  function completeSet() {
    setSession((prev) => {
      if (!prev) return prev;
      const w = WORKOUTS.find((x) => x.id === prev.activeWorkoutId);
      if (!w) return prev;

      const step = w.steps[prev.currentStepIndex];
      if (!step?.sets) return prev;

      if (prev.currentSet < step.sets) return { ...prev, currentSet: prev.currentSet + 1 };
      return advanceStep(prev, w, false);
    });
  }

  function finishSession(s: SessionState, w: Workout) {
    const totalSeconds = Math.max(1, Math.floor((Date.now() - s.startedAt) / 1000));
    const completed: CompletedSession = {
      id: uid("session"),
      workoutId: w.id,
      workoutTitle: w.title,
      completedAt: Date.now(),
      totalSeconds,
      estCalories: w.estCalories,
      notes: s.notes?.trim() || "",
    };

    setPersisted((p) => ({ ...p, history: [completed, ...p.history].slice(0, 60) }));
    setSession(null);
  }

  function abandonSession() {
    setSession(null);
  }

  function removeHistoryItem(id: string) {
    setPersisted((p) => ({ ...p, history: p.history.filter((x) => x.id !== id) }));
  }

  const sessionView = useMemo(() => {
    if (!session) return null;
    const w = WORKOUTS.find((x) => x.id === session.activeWorkoutId) || null;
    const step = w?.steps?.[session.currentStepIndex] ?? null;
    if (!w || !step) return null;

    const progressPct = Math.round(((session.currentStepIndex + 1) / w.steps.length) * 100);
    const isTimed = typeof step.durationSec === "number";
    const isStrength = typeof step.sets === "number" && !!step.reps;

    return { w, step, progressPct, isTimed, isStrength };
  }, [session]);

  /* -------------------------------------------------------------------------- */
  /*                                     UI                                     */
  /* -------------------------------------------------------------------------- */

  return (
    <div className="wk2-wrap">
      {/* TOP */}
      <div className="wk2-top">
        <div>
          <div className="wk2-badge">Workouts</div>
          <h2 className="wk2-title">Train with confidence</h2>
          <p className="wk2-sub">Beginner-friendly library, guided sessions, weekly plans, and history — in one place.</p>
        </div>

        <div className="wk2-tabs">
          <button className={`wk2-tab ${tab === "library" ? "active" : ""}`} onClick={() => setTab("library")}>
            Library
          </button>
          <button className={`wk2-tab ${tab === "plan" ? "active" : ""}`} onClick={() => setTab("plan")}>
            Plan
          </button>
          <button className={`wk2-tab ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>
            History
          </button>
        </div>
      </div>

      {/* ACTIVE SESSION STRIP */}
      {sessionView && (
        <div className="wk2-active">
          <div className="wk2-active-left">
            <div className="wk2-active-title">{sessionView.w.title}</div>
            <div className="wk2-muted">
              Step {session!.currentStepIndex + 1}/{sessionView.w.steps.length} • {sessionView.progressPct}%
            </div>
            <div className="wk2-bar">
              <div className="wk2-bar-fill" style={{ width: `${sessionView.progressPct}%` }} />
            </div>
          </div>

          <div className="wk2-active-actions">
            <button className="wk2-btn ghost" onClick={() => setPaused(!session!.paused)}>
              {session!.paused ? "Resume" : "Pause"}
            </button>
            <button className="wk2-btn danger ghost" onClick={abandonSession}>
              End
            </button>
          </div>
        </div>
      )}

      {/* LIBRARY */}
      {tab === "library" && (
        <div className="wk2-library">
          {/* HERO */}
          <div className="wk2-hero">
            <div className="wk2-hero-left">
              <div className="wk2-hero-kicker">Start here</div>
              <h3 className="wk2-hero-title">Not sure what to do today?</h3>
              <p className="wk2-hero-sub">Pick a quick start or choose a category. We’ll guide you step-by-step.</p>

              <div className="wk2-hero-actions">
                <button
                  className="wk2-btn primary"
                  onClick={() => {
                    setTab("library");
                    setSearch("");
                    setCategory("All");
                    setDifficulty("Beginner");
                    setEquipment("All");
                    setMaxDuration(30);
                  }}
                >
                  Beginner workout (≤ 30 min)
                </button>

                <button className="wk2-btn ghost" onClick={generateWeeklyPlan}>
                  Generate weekly plan
                </button>
              </div>

              {/* Recommended */}
              <div className="wk2-rec">
                <div className="wk2-rec-head">Recommended for beginners</div>
                <div className="wk2-rec-row">
                  {recommended.map((w) => (
                    <button key={w.id} className="wk2-rec-chip" onClick={() => openDrawer(w.id)} type="button">
                      <span className="wk2-rec-chip-title">{w.title}</span>
                      <span className="wk2-rec-chip-meta">{w.durationMin} min</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="wk2-hero-right" aria-hidden="true">
              <div className="wk2-collage">
                <div className="wk2-collage-tile big">
                  <img src={HERO.a} alt="" loading="lazy" />
                </div>
                <div className="wk2-collage-tile top">
                  <img src={HERO.b} alt="" loading="lazy" />
                </div>
                <div className="wk2-collage-tile mid">
                  <img src={HERO.c} alt="" loading="lazy" />
                </div>
                <div className="wk2-collage-tile bot">
                  <img src={HERO.d} alt="" loading="lazy" />
                </div>
                <div className="wk2-collage-glow" />
              </div>
            </div>
          </div>

          {/* TILES */}
          <div className="wk2-section">
            <div className="wk2-section-head">
              <h3>Pick a path</h3>
              <div className="wk2-muted">Tap a card to filter workouts.</div>
            </div>

            <div className="wk2-tiles">
              {CATEGORY_TILES.map((t) => (
                <button key={t.key} className="wk2-tile" onClick={() => applyTile(t)} type="button">
                  <div className="wk2-tile-img">
                    <img src={t.img} alt="" loading="lazy" />
                  </div>
                  <div className="wk2-tile-body">
                    <div className="wk2-tile-title">{t.title}</div>
                    <div className="wk2-tile-sub">{t.sub}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* FILTER BAR */}
          <div className="wk2-filterbar">
            <div className="wk2-filter-left">
              <input
                className="wk2-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search workouts… (e.g., core, cardio, posture)"
              />

              <select className="wk2-select" value={category} onChange={(e) => setCategory(e.target.value as any)}>
                <option value="All">All categories</option>
                <option value="Strength">Strength</option>
                <option value="Cardio">Cardio</option>
                <option value="Mobility">Mobility</option>
                <option value="Core">Core</option>
                <option value="HIIT">HIIT</option>
              </select>

              <select className="wk2-select" value={difficulty} onChange={(e) => setDifficulty(e.target.value as any)}>
                <option value="All">All levels</option>
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>

              <select className="wk2-select" value={equipment} onChange={(e) => setEquipment(e.target.value as any)}>
                <option value="All">All equipment</option>
                <option value="None">None</option>
                <option value="Dumbbells">Dumbbells</option>
                <option value="Resistance Band">Resistance band</option>
                <option value="Gym">Gym</option>
              </select>

              <div className="wk2-duration">
                <span className="wk2-muted">Max</span>
                <input
                  className="wk2-number"
                  type="number"
                  min={10}
                  max={90}
                  value={maxDuration}
                  onChange={(e) => setMaxDuration(clamp(Number(e.target.value) || 60, 10, 90))}
                />
                <span className="wk2-muted">min</span>
              </div>
            </div>

            <div className="wk2-filter-right">
              <button
                className="wk2-btn ghost"
                onClick={() => {
                  setSearch("");
                  setCategory("All");
                  setDifficulty("All");
                  setEquipment("All");
                  setMaxDuration(60);
                }}
              >
                Reset
              </button>
            </div>
          </div>

          {/* CARDS */}
          <div className="wk2-cards">
            {filtered.map((w) => (
              <button key={w.id} className="wk2-card" onClick={() => openDrawer(w.id)} type="button">
                <div className="wk2-card-img">
                  <img src={thumbForWorkout(w)} alt={w.title} loading="lazy" />
                  <div className="wk2-card-badge">{w.category}</div>
                </div>

                <div className="wk2-card-body">
                  <div className="wk2-card-title">{w.title}</div>
                  <div className="wk2-card-desc">{w.description}</div>

                  <div className="wk2-card-meta">
                    <span className="wk2-chip">{w.durationMin} min</span>
                    <span className="wk2-chip">{w.difficulty}</span>
                    <span className="wk2-chip">{w.equipment}</span>
                    <span className="wk2-chip">{w.estCalories} kcal</span>
                  </div>
                </div>
              </button>
            ))}

            {filtered.length === 0 && (
              <div className="wk2-empty">No workouts match your filters. Try resetting or selecting a tile above.</div>
            )}
          </div>
        </div>
      )}

      {/* PLAN */}
      {tab === "plan" && (
        <div className="wk2-panel">
          <div className="wk2-panel-head">
            <div>
              <h3>Your weekly plan</h3>
              <div className="wk2-muted">A balanced schedule you can follow.</div>
            </div>

            <div className="wk2-row">
              <button className="wk2-btn primary" onClick={generateWeeklyPlan}>
                {persisted.weeklyPlan ? "Regenerate" : "Generate"}
              </button>
              <button className="wk2-btn danger ghost" onClick={clearPlan} disabled={!persisted.weeklyPlan}>
                Clear
              </button>
            </div>
          </div>

          {!persisted.weeklyPlan ? (
            <div className="wk2-empty">No plan saved yet. Generate one to get started.</div>
          ) : (
            <>
              <div className="wk2-plan-grid">
                {persisted.weeklyPlan.days.map((d) => {
                  const w = WORKOUTS.find((x) => x.id === d.workoutId);
                  return (
                    <div key={d.day} className="wk2-plan-day">
                      <div className="wk2-plan-top">
                        <div className="wk2-plan-dayname">{d.day}</div>
                        <div className="wk2-chip subtle">{w?.category ?? "Workout"}</div>
                      </div>

                      <div className="wk2-plan-title">{w?.title ?? "Unknown workout"}</div>
                      <div className="wk2-muted">
                        {w?.durationMin ?? "-"} min • {w?.difficulty ?? "-"} • {w?.equipment ?? "-"}
                      </div>

                      <div className="wk2-row" style={{ marginTop: 10 }}>
                        <button className="wk2-btn ghost" onClick={() => openDrawer(d.workoutId)}>
                          View
                        </button>
                        <button className="wk2-btn primary" onClick={() => startWorkout(d.workoutId)}>
                          Start
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="wk2-muted" style={{ marginTop: 10 }}>
                Created: {fmtDate(persisted.weeklyPlan.createdAt)}
              </div>
            </>
          )}
        </div>
      )}

      {/* HISTORY */}
      {tab === "history" && (
        <div className="wk2-panel">
          <div className="wk2-panel-head">
            <div>
              <h3>Workout history</h3>
              <div className="wk2-muted">{persisted.history.length} sessions</div>
            </div>
          </div>

          {persisted.history.length === 0 ? (
            <div className="wk2-empty">No sessions yet. Start a workout from the Library.</div>
          ) : (
            <div className="wk2-history">
              {persisted.history.map((h) => (
                <div key={h.id} className="wk2-history-item">
                  <div>
                    <div className="wk2-history-title">{h.workoutTitle}</div>
                    <div className="wk2-muted">
                      {fmtDate(h.completedAt)} • {fmtTime(h.totalSeconds)} • {h.estCalories} kcal
                    </div>
                    {h.notes && <div className="wk2-note">{h.notes}</div>}
                  </div>

                  <div className="wk2-row">
                    <button className="wk2-btn ghost" onClick={() => openDrawer(h.workoutId)}>
                      View
                    </button>
                    <button className="wk2-btn danger ghost" onClick={() => removeHistoryItem(h.id)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DRAWER */}
      {drawerOpen && selectedWorkout && (
        <div className="wk2-modal" role="dialog" aria-modal="true">
          <div className="wk2-drawer">
            <div className="wk2-drawer-top">
              <div>
                <div className="wk2-drawer-title">{selectedWorkout.title}</div>
                <div className="wk2-muted">
                  {selectedWorkout.category} • {selectedWorkout.difficulty} • {selectedWorkout.durationMin} min •{" "}
                  {selectedWorkout.equipment}
                </div>
              </div>

              <button className="wk2-x" onClick={closeDrawer} title="Close">
                ×
              </button>
            </div>

            <div className="wk2-drawer-hero">
              <img src={thumbForWorkout(selectedWorkout)} alt={selectedWorkout.title} loading="lazy" />
            </div>

            <p className="wk2-muted">{selectedWorkout.description}</p>

            <div className="wk2-row" style={{ marginTop: 10, flexWrap: "wrap" }}>
              <span className="wk2-chip">{selectedWorkout.estCalories} kcal</span>
              <span className="wk2-chip">{selectedWorkout.steps.length} steps</span>
              {selectedWorkout.tags.slice(0, 4).map((t) => (
                <span key={t} className="wk2-chip subtle">
                  {t}
                </span>
              ))}
            </div>

            <div className="wk2-steps">
              <div className="wk2-steps-head">
                <h4>What you’ll do</h4>
                <span className="wk2-muted">Step-by-step</span>
              </div>

              {selectedWorkout.steps.map((s, idx) => (
                <div key={s.id} className="wk2-step">
                  <div className="wk2-step-left">
                    <div className="wk2-step-idx">{idx + 1}</div>
                    <div>
                      <div className="wk2-step-title">{s.title}</div>
                      <div className="wk2-muted">
                        {s.type === "rest" ? "Rest" : "Work"}
                        {typeof s.durationSec === "number" && ` • ${fmtTime(s.durationSec)}`}
                        {s.sets && ` • ${s.sets} sets`}
                        {s.reps && ` • ${s.reps}`}
                        {s.restSec && ` • rest ${fmtTime(s.restSec)}`}
                      </div>
                      {s.notes && <div className="wk2-muted" style={{ marginTop: 4 }}>{s.notes}</div>}
                    </div>
                  </div>

                  <div className={`wk2-step-pill ${s.type}`}>{s.type.toUpperCase()}</div>
                </div>
              ))}
            </div>

            <div className="wk2-drawer-actions">
              <button className="wk2-btn ghost" onClick={() => startWorkout(selectedWorkout.id)}>
                Start session
              </button>
              <button className="wk2-btn primary" onClick={() => startWorkout(selectedWorkout.id)}>
                Start now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SESSION */}
      {sessionView && (
        <div className="wk2-modal" role="dialog" aria-modal="true">
          <div className="wk2-session">
            <div className="wk2-session-head">
              <div>
                <div className="wk2-session-title">{sessionView.w.title}</div>
                <div className="wk2-muted">
                  {sessionView.w.category} • {sessionView.w.difficulty} • {sessionView.w.equipment}
                </div>
              </div>

              <button className="wk2-x" onClick={abandonSession} title="End session">
                ×
              </button>
            </div>

            <div className="wk2-session-body">
              <div className="wk2-session-left">
                <div className="wk2-pill">
                  Step {session!.currentStepIndex + 1} of {sessionView.w.steps.length}
                </div>

                <h3 className="wk2-session-step-title">{sessionView.step.title}</h3>

                {sessionView.step.notes && <div className="wk2-note">{sessionView.step.notes}</div>}

                <div className="wk2-session-stats">
                  {sessionView.isTimed && (
                    <div className="wk2-stat">
                      <div className="wk2-muted">Timer</div>
                      <div className="wk2-stat-big">{fmtTime(session!.remainingSec || sessionView.step.durationSec || 0)}</div>
                    </div>
                  )}

                  {sessionView.isStrength && (
                    <div className="wk2-stat">
                      <div className="wk2-muted">Sets</div>
                      <div className="wk2-stat-big">
                        {session!.currentSet} / {sessionView.step.sets}
                      </div>
                      <div className="wk2-muted">Reps: {sessionView.step.reps}</div>
                      {sessionView.step.restSec && <div className="wk2-muted">Rest: {fmtTime(sessionView.step.restSec)}</div>}
                    </div>
                  )}

                  <div className="wk2-stat">
                    <div className="wk2-muted">Type</div>
                    <div className="wk2-stat-big">{sessionView.step.type.toUpperCase()}</div>
                  </div>
                </div>

                <div className="wk2-row" style={{ marginTop: 12 }}>
                  <button className="wk2-btn ghost" onClick={prevStep}>
                    Previous
                  </button>
                  <button className="wk2-btn ghost" onClick={() => setPaused(!session!.paused)}>
                    {session!.paused ? "Resume" : "Pause"}
                  </button>
                  <button className="wk2-btn ghost" onClick={nextStep}>
                    Next
                  </button>
                </div>

                {sessionView.isStrength ? (
                  <button className="wk2-btn primary" style={{ marginTop: 10 }} onClick={completeSet}>
                    Complete set
                  </button>
                ) : (
                  <button className="wk2-btn primary" style={{ marginTop: 10 }} onClick={nextStep}>
                    Mark step complete
                  </button>
                )}
              </div>

              <div className="wk2-session-right">
                <div className="wk2-session-thumb">
                  <img src={thumbForWorkout(sessionView.w)} alt={sessionView.w.title} />
                </div>

                <label className="wk2-field">
                  <span className="wk2-muted">Session notes</span>
                  <textarea
                    value={session!.notes}
                    onChange={(e) => setSession((s) => (s ? { ...s, notes: e.target.value } : s))}
                    placeholder="Optional notes (effort, pain, adjustments)…"
                    rows={4}
                  />
                </label>

                <div className="wk2-row" style={{ marginTop: 10 }}>
                  <button
                    className="wk2-btn danger ghost"
                    onClick={() => {
                      const w = sessionView.w;
                      const s = session!;
                      const totalSeconds = Math.max(1, Math.floor((Date.now() - s.startedAt) / 1000));
                      const completed: CompletedSession = {
                        id: uid("session"),
                        workoutId: w.id,
                        workoutTitle: w.title,
                        completedAt: Date.now(),
                        totalSeconds,
                        estCalories: w.estCalories,
                        notes: s.notes?.trim() || "",
                      };
                      setPersisted((p) => ({ ...p, history: [completed, ...p.history].slice(0, 60) }));
                      setSession(null);
                    }}
                  >
                    Finish
                  </button>

                  <button className="wk2-btn ghost" onClick={abandonSession}>
                    Exit
                  </button>
                </div>

                <div className="wk2-muted" style={{ marginTop: 10 }}>
                  Timed steps auto-advance at 0. Strength steps use the set counter.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}