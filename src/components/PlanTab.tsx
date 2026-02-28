import React, { useEffect, useMemo, useRef, useState } from "react";

type BillingCycle = "Weekly" | "Monthly" | "Yearly";
type PlanTier = "Basic" | "Pro" | "Elite";

type Subscription = {
  tier: PlanTier;
  cycle: BillingCycle;
  price: number;
  currency: "INR";
  active: boolean;
  startedAt?: number;
  renewsAt?: number;
};

type CoachSpecialty = "Strength" | "Weight loss" | "Mobility" | "Rehab" | "Sports";

type Coach = {
  id: string;
  name: string;
  title: string;
  specialty: CoachSpecialty;
  rating: number;
  reviews: number;
  years: number;
  language: string[];
  pricePerMonth: number;
  availability: "Accepting clients" | "Limited slots";
  bio: string;
  highlights: string[];
};

type PlanDayName = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
type PlanStatus = "Completed" | "Pending" | "Rest";

type PlanDay = {
  day: PlanDayName;
  focus: string;
  status: PlanStatus;
};

type PaymentMethod = "UPI" | "Card" | "NetBanking";

type Persisted = {
  subscription: Subscription | null;
  bookedCoachId: string | null;
  weeklyPlan: PlanDay[];
  lastUpdatedAt: number;
};

const STORAGE_KEY = "fitnesscoach:plan:v3";

const DEFAULT_PLAN: PlanDay[] = [
  { day: "Mon", focus: "Chest & Triceps", status: "Pending" },
  { day: "Tue", focus: "Back & Biceps", status: "Pending" },
  { day: "Wed", focus: "Recovery / Mobility", status: "Rest" },
  { day: "Thu", focus: "Legs & Shoulders", status: "Pending" },
  { day: "Fri", focus: "Cardio (Zone 2)", status: "Pending" },
  { day: "Sat", focus: "Full Body (Strength)", status: "Pending" },
  { day: "Sun", focus: "Rest", status: "Rest" },
];

const COACHES: Coach[] = [
  {
    id: "c1",
    name: "Aarav Mehta",
    title: "Strength and Conditioning Coach",
    specialty: "Strength",
    rating: 4.8,
    reviews: 268,
    years: 7,
    language: ["English", "Hindi"],
    pricePerMonth: 1499,
    availability: "Accepting clients",
    bio: "Structured strength plans with measurable progression. Focus on technique, recovery, and sustainable habits.",
    highlights: ["Form correction reviews", "Progressive overload programming", "Weekly check-ins"],
  },
  {
    id: "c2",
    name: "Riya Sharma",
    title: "Weight Loss and Nutrition Coach",
    specialty: "Weight loss",
    rating: 4.7,
    reviews: 412,
    years: 6,
    language: ["English", "Hindi"],
    pricePerMonth: 1299,
    availability: "Limited slots",
    bio: "Calorie-aware planning with practical guidance. Designed for consistency, not extremes.",
    highlights: ["Meal planning framework", "Weekly progress reviews", "Habit-based coaching"],
  },
  {
    id: "c3",
    name: "Kabir Singh",
    title: "Mobility and Movement Specialist",
    specialty: "Mobility",
    rating: 4.9,
    reviews: 188,
    years: 8,
    language: ["English"],
    pricePerMonth: 1799,
    availability: "Accepting clients",
    bio: "Mobility-first approach to reduce stiffness and improve movement quality for training and daily life.",
    highlights: ["Mobility assessment", "Recovery plan", "Technique refinement"],
  },
  {
    id: "c4",
    name: "Naina Verma",
    title: "Rehab and Corrective Exercise Coach",
    specialty: "Rehab",
    rating: 4.8,
    reviews: 154,
    years: 9,
    language: ["English", "Hindi"],
    pricePerMonth: 1999,
    availability: "Limited slots",
    bio: "Corrective routines and safe return-to-training progression. Prioritizes form and pain-free movement.",
    highlights: ["Injury-safe progressions", "Form audits", "Personalized recovery plan"],
  },
];

const SUBSCRIPTIONS: Array<{
  tier: PlanTier;
  label: string;
  description: string;
  features: string[];
  weekly: number;
  monthly: number;
  yearly: number;
  popular?: boolean;
}> = [
  {
    tier: "Basic",
    label: "Basic",
    description: "Plan, track, and build consistency.",
    features: ["Weekly plan builder", "Workout and session tracking", "Basic progress insights"],
    weekly: 99,
    monthly: 249,
    yearly: 1999,
  },
  {
    tier: "Pro",
    label: "Pro",
    description: "Best for serious routine and coaching workflows.",
    features: ["Everything in Basic", "Advanced workout templates", "Priority support", "Plan adherence insights"],
    weekly: 149,
    monthly: 399,
    yearly: 2999,
    popular: true,
  },
  {
    tier: "Elite",
    label: "Elite",
    description: "For high-intent users with premium guidance.",
    features: ["Everything in Pro", "Coach hiring access", "Monthly plan reviews", "Form review queue"],
    weekly: 199,
    monthly: 599,
    yearly: 4499,
  },
];

type View = "overview" | "subscriptions" | "coaches" | "builder";
type CheckoutMode = "subscription" | "coach";

/** ✅ Replace these imports with your REAL existing images */
import coachImg1 from "../coaches/coach1.webp";
import coachImg2 from "../coaches/coach2.webp";
import coachImg3 from "../coaches/coach3.webp";
import coachImg4 from "../coaches/coach4.webp";


const COACH_IMAGES = [coachImg1, coachImg2, coachImg3, coachImg4];

function fmtDate(ts: number) {
  return new Date(ts).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtTimeOnly(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function isBrowser() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function isPlanStatus(v: unknown): v is PlanStatus {
  return v === "Completed" || v === "Pending" || v === "Rest";
}
function isPlanDayName(v: unknown): v is PlanDayName {
  return v === "Mon" || v === "Tue" || v === "Wed" || v === "Thu" || v === "Fri" || v === "Sat" || v === "Sun";
}
function sanitizeWeeklyPlan(input: unknown): PlanDay[] {
  if (!Array.isArray(input)) return DEFAULT_PLAN;

  const mapped: PlanDay[] = input
    .map((x) => {
      const obj = x as Partial<PlanDay> | null;
      if (!obj) return null;

      const day = isPlanDayName(obj.day) ? obj.day : null;
      const focus = typeof obj.focus === "string" ? obj.focus : "";
      const status = isPlanStatus(obj.status) ? obj.status : "Pending";

      if (!day) return null;
      return { day, focus: focus || "Workout", status };
    })
    .filter((x): x is PlanDay => Boolean(x));

  const days = new Set(mapped.map((d) => d.day));
  if (days.size !== 7) return DEFAULT_PLAN;

  return mapped;
}

function loadPersisted(): Persisted {
  const fallback: Persisted = {
    subscription: null,
    bookedCoachId: null,
    weeklyPlan: DEFAULT_PLAN,
    lastUpdatedAt: Date.now(),
  };

  if (!isBrowser()) return fallback;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Persisted> | null;

    return {
      subscription: parsed?.subscription ?? null,
      bookedCoachId: parsed?.bookedCoachId ?? null,
      weeklyPlan: sanitizeWeeklyPlan(parsed?.weeklyPlan),
      lastUpdatedAt: typeof parsed?.lastUpdatedAt === "number" ? parsed.lastUpdatedAt : Date.now(),
    };
  } catch {
    return fallback;
  }
}

function savePersisted(p: Persisted) {
  if (!isBrowser()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

/** --- premium-ish helpers (no backend, but looks live) --- */
function dayIndex(d: PlanDayName): number {
  const order: PlanDayName[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return order.indexOf(d);
}

function todayName(): PlanDayName {
  // JS getDay(): 0 Sun ... 6 Sat. We'll map to Mon..Sun.
  const map: PlanDayName[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const d = new Date().getDay();
  return map[d] as PlanDayName;
}

function nextPending(plan: PlanDay[], from: PlanDayName): PlanDay | null {
  const sorted = [...plan].sort((a, b) => dayIndex(a.day) - dayIndex(b.day));
  const startIdx = dayIndex(from);

  // look forward in week
  for (let i = 0; i < sorted.length; i++) {
    const idx = (startIdx + i) % sorted.length;
    const item = sorted[idx];
    if (item.status !== "Completed" && item.status !== "Rest") return item;
  }
  return null;
}

function secondsToHMS(s: number) {
  const sec = Math.max(0, Math.floor(s));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const r = sec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(r)}`;
  return `${m}:${pad(r)}`;
}

function pickImageForCoach(id: string) {
  // stable “random” by coach id
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return COACH_IMAGES[hash % COACH_IMAGES.length];
}

export function PlanTab() {
  const [persisted, setPersisted] = useState<Persisted>(() => loadPersisted());
  const [view, setView] = useState<View>("overview");

  // subscription selection
  const [cycle, setCycle] = useState<BillingCycle>("Monthly");
  const [selectedTier, setSelectedTier] = useState<PlanTier>("Pro");

  // coach search/filter
  const [coachQuery, setCoachQuery] = useState<string>("");
  const [coachSpecialty, setCoachSpecialty] = useState<CoachSpecialty | "All">("All");
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);

  // checkout modal
  const [checkoutOpen, setCheckoutOpen] = useState<boolean>(false);
  const [checkoutMode, setCheckoutMode] = useState<CheckoutMode>("subscription");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("UPI");
  const [buyerName, setBuyerName] = useState<string>("");
  const [buyerEmail, setBuyerEmail] = useState<string>("");
  const [buyerPhone, setBuyerPhone] = useState<string>("");

  // plan builder
  const [planDraft, setPlanDraft] = useState<PlanDay[]>(() => persisted.weeklyPlan);

  // live clock (for “real-time” feel)
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // keep persisted in storage
  useEffect(() => {
    savePersisted(persisted);
  }, [persisted]);

  useEffect(() => {
    setPlanDraft(persisted.weeklyPlan);
  }, [persisted.weeklyPlan]);

  const bookedCoach = useMemo(() => {
    if (!persisted.bookedCoachId) return null;
    return COACHES.find((c) => c.id === persisted.bookedCoachId) || null;
  }, [persisted.bookedCoachId]);

  const selectedCoach = useMemo(() => {
    if (!selectedCoachId) return null;
    return COACHES.find((c) => c.id === selectedCoachId) || null;
  }, [selectedCoachId]);

  const hasElite = Boolean(persisted.subscription?.active && persisted.subscription?.tier === "Elite");

  const adherence = useMemo(() => {
    const total = persisted.weeklyPlan.length;
    const completed = persisted.weeklyPlan.filter((d) => d.status === "Completed").length;
    const pct = total ? Math.round((completed / total) * 100) : 0;
    return { total, completed, pct };
  }, [persisted.weeklyPlan]);

  const tierMeta = useMemo(() => {
    return SUBSCRIPTIONS.find((s) => s.tier === selectedTier) ?? SUBSCRIPTIONS[0];
  }, [selectedTier]);

  const priceForSelection = useMemo(() => {
    if (cycle === "Weekly") return tierMeta.weekly;
    if (cycle === "Monthly") return tierMeta.monthly;
    return tierMeta.yearly;
  }, [cycle, tierMeta]);

  const filteredCoaches = useMemo(() => {
    const q = coachQuery.trim().toLowerCase();
    return COACHES.filter((c) => {
      if (coachSpecialty !== "All" && c.specialty !== coachSpecialty) return false;
      if (!q) return true;

      const hay = `${c.name} ${c.title} ${c.specialty} ${c.bio} ${c.highlights.join(" ")}`.toLowerCase();
      return hay.includes(q);
    }).sort((a, b) => b.rating - a.rating);
  }, [coachQuery, coachSpecialty]);

  const today = useMemo(() => todayName(), []);
  const todayItem = useMemo(() => persisted.weeklyPlan.find((d) => d.day === today) || null, [persisted.weeklyPlan, today]);
  const nextUp = useMemo(() => nextPending(persisted.weeklyPlan, today), [persisted.weeklyPlan, today]);

  // next-up “session time” (fake but stable): today 7:00 PM or next day 7:00 PM
  const nextSessionTs = useMemo(() => {
    const base = new Date();
    base.setSeconds(0);
    base.setMilliseconds(0);
    base.setHours(19, 0, 0, 0); // 7 PM

    // if already passed today 7 PM, move to tomorrow
    if (base.getTime() <= now) base.setDate(base.getDate() + 1);

    return base.getTime();
  }, [now]);

  const countdown = useMemo(() => secondsToHMS((nextSessionTs - now) / 1000), [nextSessionTs, now]);

  // activity feed (generated from your persisted data)
  const activity = useMemo(() => {
    const items: Array<{ title: string; sub: string; ts: number }> = [];
    items.push({ title: "Sync complete", sub: `Last updated ${fmtDate(persisted.lastUpdatedAt)}`, ts: persisted.lastUpdatedAt });

    if (persisted.subscription?.active) {
      items.push({
        title: `Subscription active: ${persisted.subscription.tier}`,
        sub: `Renews ${persisted.subscription.renewsAt ? fmtDate(persisted.subscription.renewsAt) : "-"}`,
        ts: persisted.subscription.startedAt ?? persisted.lastUpdatedAt,
      });
    } else {
      items.push({ title: "No active subscription", sub: "Upgrade for advanced planning + coaching.", ts: persisted.lastUpdatedAt - 200000 });
    }

    if (persisted.bookedCoachId) {
      const c = COACHES.find((x) => x.id === persisted.bookedCoachId);
      items.push({
        title: `Coach booked`,
        sub: c ? `${c.name} • ${c.specialty}` : "Coach",
        ts: persisted.lastUpdatedAt - 120000,
      });
    } else {
      items.push({ title: "Coach not booked", sub: "Browse marketplace for premium coaching.", ts: persisted.lastUpdatedAt - 300000 });
    }

    const completed = persisted.weeklyPlan.filter((d) => d.status === "Completed");
    if (completed.length) {
      items.push({
        title: `You completed ${completed.length} sessions`,
        sub: `Adherence ${adherence.pct}% this week`,
        ts: persisted.lastUpdatedAt - 60000,
      });
    }

    return items
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 6);
  }, [persisted, adherence.pct]);

  function openSubscriptionCheckout() {
    setCheckoutMode("subscription");
    setCheckoutOpen(true);
  }

  function openCoachCheckout(coachId: string) {
    setSelectedCoachId(coachId);
    setCheckoutMode("coach");
    setCheckoutOpen(true);
  }

  function closeCheckout() {
    setCheckoutOpen(false);
  }

  function activateSubscription() {
    const nowTs = Date.now();
    const renewMs =
      cycle === "Weekly"
        ? 7 * 24 * 3600 * 1000
        : cycle === "Monthly"
          ? 30 * 24 * 3600 * 1000
          : 365 * 24 * 3600 * 1000;

    const sub: Subscription = {
      tier: selectedTier,
      cycle,
      price: priceForSelection,
      currency: "INR",
      active: true,
      startedAt: nowTs,
      renewsAt: nowTs + renewMs,
    };

    setPersisted((p) => ({
      ...p,
      subscription: sub,
      lastUpdatedAt: Date.now(),
    }));

    setCheckoutOpen(false);
    setView("overview");
  }

  function bookCoach() {
    if (!selectedCoachId) return;

    setPersisted((p) => ({
      ...p,
      bookedCoachId: selectedCoachId,
      lastUpdatedAt: Date.now(),
    }));

    setCheckoutOpen(false);
    setView("overview");
  }

  function cancelSubscription() {
    setPersisted((p) => ({
      ...p,
      subscription: null,
      lastUpdatedAt: Date.now(),
    }));
  }

  function unbookCoach() {
    setPersisted((p) => ({
      ...p,
      bookedCoachId: null,
      lastUpdatedAt: Date.now(),
    }));
  }

  function markDay(day: PlanDayName, status: PlanStatus) {
    setPersisted((p) => ({
      ...p,
      weeklyPlan: p.weeklyPlan.map((d) => (d.day === day ? { ...d, status } : d)),
      lastUpdatedAt: Date.now(),
    }));
  }

  function updateDraft(day: PlanDayName, focus: string, status: PlanStatus) {
    setPlanDraft((prev) => prev.map((d) => (d.day === day ? { ...d, focus, status } : d)));
  }

  function saveDraft() {
    setPersisted((p) => ({
      ...p,
      weeklyPlan: planDraft,
      lastUpdatedAt: Date.now(),
    }));
    setView("overview");
  }

  function resetDraft() {
    setPlanDraft(DEFAULT_PLAN);
  }

  function isCoachSpecialty(v: string): v is CoachSpecialty {
    return v === "Strength" || v === "Weight loss" || v === "Mobility" || v === "Rehab" || v === "Sports";
  }
  function isBillingCycle(v: string): v is BillingCycle {
    return v === "Weekly" || v === "Monthly" || v === "Yearly";
  }
  function isPlanTier(v: string): v is PlanTier {
    return v === "Basic" || v === "Pro" || v === "Elite";
  }
  function isPaymentMethod(v: string): v is PaymentMethod {
    return v === "UPI" || v === "Card" || v === "NetBanking";
  }

  function onChangeSpecialty(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    setCoachSpecialty(v === "All" ? "All" : isCoachSpecialty(v) ? v : "All");
  }

  function onChangeCycle(next: string) {
    if (isBillingCycle(next)) setCycle(next);
  }

  function onChangePayment(next: string) {
    if (isPaymentMethod(next)) setPaymentMethod(next);
  }

  function onSelectTier(next: string) {
    if (isPlanTier(next)) setSelectedTier(next);
  }

  const checkoutCoach = useMemo(() => {
    if (checkoutMode !== "coach") return null;
    if (!selectedCoachId) return null;
    return COACHES.find((c) => c.id === selectedCoachId) || null;
  }, [checkoutMode, selectedCoachId]);

  return (
    <div className="plx-wrap">
      {/* HEADER */}
      <div className="plx-head">
        <div className="plx-headLeft">
          <div className="plx-chip">Plan</div>
          <h2 className="plx-title">Your weekly plan, upgrades & coaching</h2>
          <p className="plx-sub">
            Real-time progress, premium subscriptions, and coach marketplace — all in one place.
          </p>

          <div className="plx-nav">
            <button className={`plx-tab ${view === "overview" ? "active" : ""}`} onClick={() => setView("overview")} type="button">
              Overview
            </button>
            <button className={`plx-tab ${view === "builder" ? "active" : ""}`} onClick={() => setView("builder")} type="button">
              Builder
            </button>
            <button className={`plx-tab ${view === "subscriptions" ? "active" : ""}`} onClick={() => setView("subscriptions")} type="button">
              Subscriptions
            </button>
            <button className={`plx-tab ${view === "coaches" ? "active" : ""}`} onClick={() => setView("coaches")} type="button">
              Coaches
            </button>
          </div>
        </div>

        <div className="plx-headRight">
          <div className="plx-live">
            <span className="plx-liveDot" />
            <div className="plx-liveText">
              <div className="plx-liveTop">Live</div>
              <div className="plx-liveSub">Updated {fmtTimeOnly(now)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* OVERVIEW */}
      {view === "overview" && (
        <div className="plx-grid">
          {/* Left column */}
          <div className="plx-col">
            {/* Today card */}
            <div className="card plx-card plx-hero">
              <div className="plx-heroTop">
                <div>
                  <div className="plx-heroKicker">Today • {today}</div>
                  <div className="plx-heroTitle">{todayItem?.focus ?? "No plan found"}</div>
                  <div className="plx-heroMeta">
                    <span className={`plx-pill ${todayItem?.status === "Completed" ? "ok" : todayItem?.status === "Rest" ? "muted" : "pending"}`}>
                      {todayItem?.status ?? "Pending"}
                    </span>
                    <span className="plx-pill subtle">Next session in {countdown}</span>
                    <span className="plx-pill subtle">Adherence {adherence.pct}%</span>
                  </div>
                </div>

                <div className="plx-heroActions">
                  <button
                    className="plx-btn primary"
                    onClick={() => todayItem && todayItem.status !== "Rest" && markDay(todayItem.day, "Completed")}
                    disabled={!todayItem || todayItem.status === "Rest"}
                    type="button"
                  >
                    Mark done
                  </button>
                  <button className="plx-btn ghost" onClick={() => setView("builder")} type="button">
                    Edit plan
                  </button>
                </div>
              </div>

              <div className="plx-progressWrap">
                <div className="plx-progress">
                  <div className="plx-progressFill" style={{ width: `${adherence.pct}%` }} />
                </div>
                <div className="plx-muted mini">
                  {adherence.completed}/{adherence.total} sessions completed • Last sync {fmtDate(persisted.lastUpdatedAt)}
                </div>
              </div>

              {/* Next up preview */}
              <div className="plx-nextUp">
                <div className="plx-nextLeft">
                  <div className="plx-nextTitle">Next up</div>
                  <div className="plx-nextSub">{nextUp ? `${nextUp.day} • ${nextUp.focus}` : "Nothing pending — great week."}</div>
                </div>
                <div className="plx-nextRight">
                  <button className="plx-btn ghost" onClick={() => setView("overview")} type="button">
                    View timeline
                  </button>
                </div>
              </div>
            </div>

            {/* Weekly timeline (premium) */}
            <div className="card plx-card">
              <div className="plx-cardHead">
                <h3>Weekly timeline</h3>
                <span className="plx-pill subtle">Tap to update</span>
              </div>

              <div className="plx-week">
                {persisted.weeklyPlan.map((d) => {
                  const isToday = d.day === today;
                  return (
                    <button
                      key={d.day}
                      className={`plx-dayRow ${isToday ? "isToday" : ""}`}
                      onClick={() => {
                        if (d.status === "Rest") return;
                        markDay(d.day, d.status === "Completed" ? "Pending" : "Completed");
                      }}
                      type="button"
                    >
                      <div className="plx-dayLeft">
                        <div className={`plx-dot ${d.status === "Completed" ? "ok" : d.status === "Rest" ? "rest" : "pending"}`} />
                        <div className="plx-dayText">
                          <div className="plx-dayTop">
                            <span className="plx-dayName">{d.day}</span>
                            {isToday && <span className="plx-miniTag">Today</span>}
                            <span className={`plx-status ${d.status === "Completed" ? "ok" : d.status === "Rest" ? "muted" : "pending"}`}>
                              {d.status}
                            </span>
                          </div>
                          <div className="plx-dayFocus">{d.focus}</div>
                        </div>
                      </div>

                      <div className="plx-dayRight">
                        <span className="plx-chevron">›</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="plx-side">
            {/* Subscription card */}
            <div className="card plx-card">
              <div className="plx-cardHead">
                <h3>Subscription</h3>
                <span className={`plx-pill ${persisted.subscription?.active ? "ok" : "muted"}`}>
                  {persisted.subscription?.active ? "Active" : "Inactive"}
                </span>
              </div>

              {!persisted.subscription?.active ? (
                <>
                  <p className="plx-muted">Upgrade to unlock advanced plan insights and premium coaching workflow.</p>
                  <div className="plx-row">
                    <button className="plx-btn primary" onClick={() => setView("subscriptions")} type="button">
                      Explore plans
                    </button>
                    <button className="plx-btn ghost" onClick={openSubscriptionCheckout} type="button">
                      Quick checkout
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="plx-kvGrid">
                    <div className="plx-kv">
                      <div className="k">Tier</div>
                      <div className="v">{persisted.subscription.tier}</div>
                    </div>
                    <div className="plx-kv">
                      <div className="k">Billing</div>
                      <div className="v">
                        {persisted.subscription.cycle} • INR {persisted.subscription.price}
                      </div>
                    </div>
                    <div className="plx-kv">
                      <div className="k">Renews</div>
                      <div className="v">{persisted.subscription.renewsAt ? fmtDate(persisted.subscription.renewsAt) : "-"}</div>
                    </div>
                  </div>

                  <div className="plx-row">
                    <button className="plx-btn ghost" onClick={() => setView("subscriptions")} type="button">
                      Change
                    </button>
                    <button className="plx-btn danger" onClick={cancelSubscription} type="button">
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Coach card (with image) */}
            <div className="card plx-card">
              <div className="plx-cardHead">
                <h3>Coach</h3>
                <span className={`plx-pill ${bookedCoach ? "ok" : "muted"}`}>{bookedCoach ? "Booked" : "Not booked"}</span>
              </div>

              {!bookedCoach ? (
                <>
                  <p className="plx-muted">Hire a coach for plan reviews, accountability, and technique support.</p>
                  {!hasElite && <div className="plx-callout">Coach hiring is available in the Elite tier (you can still browse).</div>}
                  <div className="plx-row">
                    <button className="plx-btn primary" onClick={() => setView("coaches")} type="button">
                      Browse coaches
                    </button>
                  </div>
                </>
              ) : (
                <div className="plx-coachBooked">
                  <div className="plx-coachTop">
                    <img className="plx-coachImg" src={pickImageForCoach(bookedCoach.id)} alt={bookedCoach.name} />
                    <div className="plx-coachMeta">
                      <div className="plx-coachName">{bookedCoach.name}</div>
                      <div className="plx-muted mini">{bookedCoach.title}</div>
                      <div className="plx-muted mini">
                        {bookedCoach.specialty} • {bookedCoach.rating} • {bookedCoach.reviews} reviews
                      </div>
                    </div>
                  </div>

                  <div className="plx-row">
                    <button className="plx-btn ghost" onClick={() => setView("coaches")} type="button">
                      Change coach
                    </button>
                    <button className="plx-btn danger" onClick={unbookCoach} type="button">
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Activity feed */}
            <div className="card plx-card">
              <div className="plx-cardHead">
                <h3>Activity</h3>
                <span className="plx-pill subtle">Auto</span>
              </div>

              <div className="plx-activity">
                {activity.map((a, idx) => (
                  <div key={`${a.ts}-${idx}`} className="plx-activityItem">
                    <div className="plx-activityTitle">{a.title}</div>
                    <div className="plx-activitySub">
                      {a.sub} • {fmtTimeOnly(a.ts)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="plx-row" style={{ marginTop: 10 }}>
                <button className="plx-btn ghost" onClick={() => setView("builder")} type="button">
                  Edit weekly plan
                </button>
                <button
                  className="plx-btn ghost"
                  onClick={() => {
                    setSelectedTier("Pro");
                    setCycle("Monthly");
                    openSubscriptionCheckout();
                  }}
                  type="button"
                >
                  Upgrade Pro
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBSCRIPTIONS */}
      {view === "subscriptions" && (
        <div className="card plx-card" style={{ marginTop: 12 }}>
          <div className="plx-cardHead">
            <h3>Subscription plans</h3>
            <div className="plx-cycle">
              <button className={`plx-chipBtn ${cycle === "Weekly" ? "active" : ""}`} onClick={() => onChangeCycle("Weekly")} type="button">
                Weekly
              </button>
              <button className={`plx-chipBtn ${cycle === "Monthly" ? "active" : ""}`} onClick={() => onChangeCycle("Monthly")} type="button">
                Monthly
              </button>
              <button className={`plx-chipBtn ${cycle === "Yearly" ? "active" : ""}`} onClick={() => onChangeCycle("Yearly")} type="button">
                Yearly
              </button>
            </div>
          </div>

          <div className="plx-tierGrid">
            {SUBSCRIPTIONS.map((s) => {
              const price = cycle === "Weekly" ? s.weekly : cycle === "Monthly" ? s.monthly : s.yearly;
              const selected = selectedTier === s.tier;

              return (
                <div key={s.tier} className={`plx-tier ${selected ? "selected" : ""}`}>
                  <div className="plx-tierTop">
                    <div>
                      <div className="plx-tierName">{s.label}</div>
                      <div className="plx-muted mini">{s.description}</div>
                    </div>
                    {s.popular && <span className="plx-pill">Most popular</span>}
                  </div>

                  <div className="plx-price">
                    <div className="plx-priceAmt">INR {price}</div>
                    <div className="plx-muted mini">per {cycle.toLowerCase()}</div>
                  </div>

                  <div className="plx-featureList">
                    {s.features.map((f) => (
                      <div key={f} className="plx-feature">
                        {f}
                      </div>
                    ))}
                  </div>

                  <div className="plx-row">
                    <button className={`plx-btn ${selected ? "primary" : "ghost"}`} onClick={() => onSelectTier(s.tier)} type="button">
                      {selected ? "Selected" : "Select"}
                    </button>
                    <button className="plx-btn primary" onClick={openSubscriptionCheckout} type="button">
                      Continue
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="plx-muted mini" style={{ marginTop: 10 }}>
            Payments are shown as a UI flow. Integrate Razorpay/Stripe with a backend for real transactions.
          </div>
        </div>
      )}

      {/* COACHES */}
      {view === "coaches" && (
        <div className="plx-coaches">
          <div className="card plx-card" style={{ marginTop: 12 }}>
            <div className="plx-cardHead">
              <h3>Coach marketplace</h3>
              <span className="plx-pill subtle">{filteredCoaches.length} results</span>
            </div>

            <div className="plx-filters">
              <label className="plx-field">
                <span>Search</span>
                <input
                  value={coachQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCoachQuery(e.target.value)}
                  placeholder="Name, specialty, keywords..."
                />
              </label>

              <label className="plx-field">
                <span>Specialty</span>
                <select value={coachSpecialty} onChange={onChangeSpecialty}>
                  <option value="All">All</option>
                  <option value="Strength">Strength</option>
                  <option value="Weight loss">Weight loss</option>
                  <option value="Mobility">Mobility</option>
                  <option value="Rehab">Rehab</option>
                  <option value="Sports">Sports</option>
                </select>
              </label>
            </div>

            <div className="plx-coachGrid">
              {filteredCoaches.map((c) => {
                const isBooked = persisted.bookedCoachId === c.id;
                const img = pickImageForCoach(c.id);

                return (
                  <div key={c.id} className="plx-coachCard">
                    <div className="plx-coachCardTop">
                      <img className="plx-coachCardImg" src={img} alt={c.name} />
                      <div className="plx-coachCardMeta">
                        <div className="plx-coachName">{c.name}</div>
                        <div className="plx-muted mini">{c.title}</div>
                        <div className="plx-muted mini">
                          {c.specialty} • {c.years} yrs • {c.rating} ({c.reviews})
                        </div>
                      </div>
                      <span className={`plx-pill subtle ${c.availability === "Limited slots" ? "warn" : ""}`}>{c.availability}</span>
                    </div>

                    <div className="plx-priceRow">
                      <div className="plx-priceAmt">INR {c.pricePerMonth}</div>
                      <div className="plx-muted mini">per month</div>
                    </div>

                    <div className="plx-featureList">
                      {c.highlights.map((h) => (
                        <div key={h} className="plx-feature">
                          {h}
                        </div>
                      ))}
                    </div>

                    <div className="plx-row">
                      <button className="plx-btn ghost" onClick={() => setSelectedCoachId(c.id)} type="button">
                        View
                      </button>
                      <button
                        className={`plx-btn ${isBooked ? "ghost" : "primary"}`}
                        onClick={() => openCoachCheckout(c.id)}
                        disabled={!hasElite && !isBooked}
                        title={!hasElite ? "Coach hiring requires Elite tier" : ""}
                        type="button"
                      >
                        {isBooked ? "Booked" : "Hire coach"}
                      </button>
                    </div>

                    {!hasElite && !isBooked && <div className="plx-muted mini">Upgrade to Elite to hire coaches.</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Coach drawer */}
          {selectedCoach && (
            <div className="plx-modal" role="dialog" aria-modal="true">
              <div className="plx-drawer card">
                <div className="plx-drawerHead">
                  <div className="plx-drawerLeft">
                    <img className="plx-drawerImg" src={pickImageForCoach(selectedCoach.id)} alt={selectedCoach.name} />
                    <div>
                      <div className="plx-drawerTitle">{selectedCoach.name}</div>
                      <div className="plx-muted mini">{selectedCoach.title}</div>
                      <div className="plx-muted mini">
                        {selectedCoach.specialty} • {selectedCoach.rating} • {selectedCoach.reviews} reviews
                      </div>
                    </div>
                  </div>
                  <button className="plx-icon" onClick={() => setSelectedCoachId(null)} title="Close" type="button">
                    ×
                  </button>
                </div>

                <p className="plx-muted" style={{ marginTop: 10 }}>
                  {selectedCoach.bio}
                </p>

                <div className="plx-kvGrid">
                  <div className="plx-kv">
                    <div className="k">Experience</div>
                    <div className="v">{selectedCoach.years} years</div>
                  </div>
                  <div className="plx-kv">
                    <div className="k">Languages</div>
                    <div className="v">{selectedCoach.language.join(", ")}</div>
                  </div>
                  <div className="plx-kv">
                    <div className="k">Availability</div>
                    <div className="v">{selectedCoach.availability}</div>
                  </div>
                  <div className="plx-kv">
                    <div className="k">Pricing</div>
                    <div className="v">INR {selectedCoach.pricePerMonth} / month</div>
                  </div>
                </div>

                <div className="plx-featureList" style={{ marginTop: 12 }}>
                  {selectedCoach.highlights.map((h) => (
                    <div key={h} className="plx-feature">
                      {h}
                    </div>
                  ))}
                </div>

                <div className="plx-row" style={{ marginTop: 14, justifyContent: "flex-end" }}>
                  <button className="plx-btn ghost" onClick={() => setSelectedCoachId(null)} type="button">
                    Close
                  </button>
                  <button className="plx-btn primary" onClick={() => openCoachCheckout(selectedCoach.id)} disabled={!hasElite} type="button">
                    Hire coach
                  </button>
                </div>

                {!hasElite && <div className="plx-callout">Coach hiring requires the Elite subscription. You can still view profiles.</div>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* BUILDER */}
      {view === "builder" && (
        <div className="card plx-card" style={{ marginTop: 12 }}>
          <div className="plx-cardHead">
            <h3>Plan builder</h3>
            <div className="plx-row">
              <button className="plx-btn ghost" onClick={resetDraft} type="button">
                Reset
              </button>
              <button className="plx-btn primary" onClick={saveDraft} type="button">
                Save
              </button>
            </div>
          </div>

          <div className="plx-builder">
            {planDraft.map((d) => (
              <div key={d.day} className="plx-builderRow">
                <div className="plx-dayLabel">{d.day}</div>

                <label className="plx-field">
                  <span>Focus</span>
                  <input value={d.focus} onChange={(e) => updateDraft(d.day, e.target.value, d.status)} />
                </label>

                <label className="plx-field">
                  <span>Status</span>
                  <select
                    value={d.status}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      updateDraft(d.day, d.focus, (isPlanStatus(e.target.value) ? e.target.value : "Pending") as PlanStatus)
                    }
                  >
                    <option value="Pending">Pending</option>
                    <option value="Completed">Completed</option>
                    <option value="Rest">Rest</option>
                  </select>
                </label>
              </div>
            ))}
          </div>

          <div className="plx-muted mini" style={{ marginTop: 10 }}>
            In production, plan generation should use user goals, equipment, constraints — via a service.
          </div>
        </div>
      )}

      {/* CHECKOUT */}
      {checkoutOpen && (
        <div className="plx-modal" role="dialog" aria-modal="true">
          <div className="plx-checkout card">
            <div className="plx-drawerHead">
              <div>
                <div className="plx-drawerTitle">Checkout</div>
                <div className="plx-muted mini">
                  {checkoutMode === "subscription"
                    ? `Subscription: ${selectedTier} • ${cycle} • INR ${priceForSelection}`
                    : checkoutCoach
                      ? `Coach: ${checkoutCoach.name} • INR ${checkoutCoach.pricePerMonth} / month`
                      : "Coach checkout"}
                </div>
              </div>
              <button className="plx-icon" onClick={closeCheckout} title="Close" type="button">
                ×
              </button>
            </div>

            <div className="plx-checkGrid">
              <div>
                <div className="plx-cardHead">
                  <h3>Payment method</h3>
                  <span className="plx-pill subtle">Secure UI flow</span>
                </div>

                <div className="plx-methods">
                  {(["UPI", "Card", "NetBanking"] as PaymentMethod[]).map((m) => (
                    <button key={m} className={`plx-method ${paymentMethod === m ? "active" : ""}`} onClick={() => onChangePayment(m)} type="button">
                      {m}
                    </button>
                  ))}
                </div>

                <div className="plx-cardHead" style={{ marginTop: 14 }}>
                  <h3>Billing details</h3>
                  <span className="plx-pill subtle">Receipt</span>
                </div>

                <div className="plx-form">
                  <label className="plx-field">
                    <span>Full name</span>
                    <input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="Name" />
                  </label>
                  <label className="plx-field">
                    <span>Email</span>
                    <input value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} placeholder="Email" />
                  </label>
                  <label className="plx-field">
                    <span>Phone</span>
                    <input value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} placeholder="Phone" />
                  </label>
                </div>

                <div className="plx-muted mini" style={{ marginTop: 10 }}>
                  Payments are mocked for UI. Integrate Razorpay/Stripe to enable real transactions.
                </div>
              </div>

              <div className="plx-summary">
                <div className="plx-cardHead">
                  <h3>Order summary</h3>
                  <span className="plx-pill">Total</span>
                </div>

                <div className="plx-summaryBox">
                  {checkoutMode === "subscription" ? (
                    <>
                      <div className="plx-sumRow">
                        <div className="k">Plan</div>
                        <div className="v">{selectedTier}</div>
                      </div>
                      <div className="plx-sumRow">
                        <div className="k">Cycle</div>
                        <div className="v">{cycle}</div>
                      </div>
                      <div className="plx-sumRow">
                        <div className="k">Amount</div>
                        <div className="v">INR {priceForSelection}</div>
                      </div>
                      <div className="plx-divider" />
                      <div className="plx-sumRow total">
                        <div className="k">Total payable</div>
                        <div className="v">INR {priceForSelection}</div>
                      </div>

                      <button className="plx-btn primary" style={{ width: "100%", marginTop: 12 }} onClick={activateSubscription} type="button">
                        Pay & activate
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="plx-sumRow">
                        <div className="k">Coach</div>
                        <div className="v">{checkoutCoach?.name ?? "-"}</div>
                      </div>
                      <div className="plx-sumRow">
                        <div className="k">Billing</div>
                        <div className="v">Monthly</div>
                      </div>
                      <div className="plx-sumRow">
                        <div className="k">Amount</div>
                        <div className="v">INR {checkoutCoach?.pricePerMonth ?? "-"}</div>
                      </div>
                      <div className="plx-divider" />
                      <div className="plx-sumRow total">
                        <div className="k">Total payable</div>
                        <div className="v">INR {checkoutCoach?.pricePerMonth ?? "-"}</div>
                      </div>

                      <button className="plx-btn primary" style={{ width: "100%", marginTop: 12 }} onClick={bookCoach} disabled={!hasElite} type="button">
                        Pay & hire coach
                      </button>

                      {!hasElite && <div className="plx-callout" style={{ marginTop: 10 }}>Coach hiring requires Elite subscription.</div>}
                    </>
                  )}

                  <button className="plx-btn ghost" style={{ width: "100%", marginTop: 10 }} onClick={closeCheckout} type="button">
                    Cancel
                  </button>
                </div>

                <div className="plx-muted mini" style={{ marginTop: 10 }}>
                  By continuing, you agree to terms and recurring billing policy.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}