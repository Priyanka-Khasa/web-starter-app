import React, { useEffect, useMemo, useRef, useState } from "react";
import n1 from "../assets/nutrition-image1.webp";
import n2 from "../assets/nutrition-image2.webp";
import n3 from "../assets/nutrition-image3.webp";
import n4 from "../assets/nutrition-image4.webp";

/**
 * NutritionTab (NO AI / NO MODEL / NO CAMERA)
 * A premium, offline-first nutrition tracker:
 * - Profile (age/sex/height/weight/activity/goal)
 * - BMR + TDEE + daily calorie target
 * - Macro targets (Protein/Carbs/Fat) with smart defaults
 * - Offline food DB + custom foods
 * - Food diary logging + totals + remaining
 * - LocalStorage persistence
 */

type Sex = "female" | "male";
type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
type Goal = "lose" | "maintain" | "gain";

type Macro = { proteinG: number; carbsG: number; fatG: number };

type FoodItem = {
  id: string;
  name: string;
  mode: "per100g" | "perServing";
  baseAmount: number; // 100 for per100g, 1 for perServing
  unitLabel: string; // "g" or "serving"
  calories: number; // per baseAmount
  proteinG: number;
  carbsG: number;
  fatG: number;
  tags?: string[];
};

type DiaryEntry = {
  id: string;
  dateISO: string; // YYYY-MM-DD
  foodId: string;
  foodName: string;
  qty: number;
  unitLabel: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  meal: "breakfast" | "lunch" | "snack" | "dinner";
  createdAt: number;
};

type Profile = {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goal: Goal;

  // optional override
  targetCalories?: number;

  // strategy knobs
  proteinPerKg: number; // default 1.6g/kg
  fatPercent: number; // default 25%
};

type AppState = {
  profile: Profile;
  foods: FoodItem[];
  diary: DiaryEntry[];
  selectedDateISO: string;
};

const STORAGE_KEY = "fitnesscoach:nutrition:v2";

/* ---------------- Helpers ---------------- */
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function round(n: number, digits = 0) {
  const p = Math.pow(10, digits);
  return Math.round(n * p) / p;
}

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function activityMultiplier(a: ActivityLevel) {
  switch (a) {
    case "sedentary":
      return 1.2;
    case "light":
      return 1.375;
    case "moderate":
      return 1.55;
    case "active":
      return 1.725;
    case "very_active":
      return 1.9;
  }
}

/** Mifflin-St Jeor (kg, cm, years) */
function calcBMR(profile: Profile) {
  const w = profile.weightKg;
  const h = profile.heightCm;
  const a = profile.age;
  const base = 10 * w + 6.25 * h - 5 * a;
  return profile.sex === "male" ? base + 5 : base - 161;
}

function calcTDEE(profile: Profile) {
  return calcBMR(profile) * activityMultiplier(profile.activity);
}

function goalDelta(goal: Goal) {
  if (goal === "lose") return -400;
  if (goal === "gain") return +300;
  return 0;
}

function formatKcal(n: number) {
  return `${Math.max(0, Math.round(n))} kcal`;
}

function mealLabel(m: DiaryEntry["meal"]) {
  switch (m) {
    case "breakfast":
      return "Breakfast";
    case "lunch":
      return "Lunch";
    case "snack":
      return "Snack";
    case "dinner":
      return "Dinner";
  }
}

function scaleFood(food: FoodItem, qty: number): Macro & { calories: number } {
  const factor = food.mode === "per100g" ? qty / 100 : qty / 1;
  return {
    calories: food.calories * factor,
    proteinG: food.proteinG * factor,
    carbsG: food.carbsG * factor,
    fatG: food.fatG * factor,
  };
}

/* ---------------- Offline Food DB ---------------- */
const DEFAULT_FOODS: FoodItem[] = [
  {
    id: "rice_cooked",
    name: "Rice (cooked)",
    mode: "per100g",
    baseAmount: 100,
    unitLabel: "g",
    calories: 130,
    proteinG: 2.7,
    carbsG: 28.2,
    fatG: 0.3,
    tags: ["carb", "staple"],
  },
  {
    id: "roti_plain",
    name: "Roti/Chapati (1 medium)",
    mode: "perServing",
    baseAmount: 1,
    unitLabel: "serving",
    calories: 110,
    proteinG: 3.2,
    carbsG: 20,
    fatG: 2.2,
    tags: ["carb", "indian"],
  },
  {
    id: "dal_cooked",
    name: "Dal (cooked)",
    mode: "per100g",
    baseAmount: 100,
    unitLabel: "g",
    calories: 116,
    proteinG: 9,
    carbsG: 20,
    fatG: 0.4,
    tags: ["protein", "indian"],
  },
  {
    id: "paneer",
    name: "Paneer",
    mode: "per100g",
    baseAmount: 100,
    unitLabel: "g",
    calories: 265,
    proteinG: 18,
    carbsG: 2,
    fatG: 21,
    tags: ["protein", "fat"],
  },
  {
    id: "curd",
    name: "Curd/Dahi (plain)",
    mode: "per100g",
    baseAmount: 100,
    unitLabel: "g",
    calories: 61,
    proteinG: 3.5,
    carbsG: 4.7,
    fatG: 3.3,
    tags: ["protein"],
  },
  {
    id: "milk_toned",
    name: "Milk (toned)",
    mode: "per100g",
    baseAmount: 100,
    unitLabel: "g",
    calories: 60,
    proteinG: 3.2,
    carbsG: 4.8,
    fatG: 3.2,
    tags: ["protein"],
  },
  {
    id: "banana",
    name: "Banana",
    mode: "per100g",
    baseAmount: 100,
    unitLabel: "g",
    calories: 89,
    proteinG: 1.1,
    carbsG: 22.8,
    fatG: 0.3,
    tags: ["fruit", "carb"],
  },
  {
    id: "apple",
    name: "Apple",
    mode: "per100g",
    baseAmount: 100,
    unitLabel: "g",
    calories: 52,
    proteinG: 0.3,
    carbsG: 13.8,
    fatG: 0.2,
    tags: ["fruit"],
  },
  {
    id: "oats",
    name: "Oats (dry)",
    mode: "per100g",
    baseAmount: 100,
    unitLabel: "g",
    calories: 389,
    proteinG: 16.9,
    carbsG: 66.3,
    fatG: 6.9,
    tags: ["breakfast", "fiber"],
  },
  {
    id: "egg_boiled",
    name: "Egg (boiled) — 1",
    mode: "perServing",
    baseAmount: 1,
    unitLabel: "serving",
    calories: 78,
    proteinG: 6.3,
    carbsG: 0.6,
    fatG: 5.3,
    tags: ["protein"],
  },
  {
    id: "almonds",
    name: "Almonds",
    mode: "per100g",
    baseAmount: 100,
    unitLabel: "g",
    calories: 579,
    proteinG: 21.2,
    carbsG: 21.6,
    fatG: 49.9,
    tags: ["fat", "snack"],
  },
  {
    id: "peanut_butter",
    name: "Peanut Butter",
    mode: "per100g",
    baseAmount: 100,
    unitLabel: "g",
    calories: 588,
    proteinG: 25,
    carbsG: 20,
    fatG: 50,
    tags: ["fat", "protein"],
  },
  {
    id: "chole",
    name: "Chole/Chickpeas (cooked)",
    mode: "per100g",
    baseAmount: 100,
    unitLabel: "g",
    calories: 164,
    proteinG: 8.9,
    carbsG: 27.4,
    fatG: 2.6,
    tags: ["protein", "indian"],
  },
  {
    id: "rajma",
    name: "Rajma/Kidney Beans (cooked)",
    mode: "per100g",
    baseAmount: 100,
    unitLabel: "g",
    calories: 127,
    proteinG: 8.7,
    carbsG: 22.8,
    fatG: 0.5,
    tags: ["protein", "indian"],
  },
  {
    id: "veg_salad",
    name: "Mixed Vegetable Salad",
    mode: "per100g",
    baseAmount: 100,
    unitLabel: "g",
    calories: 35,
    proteinG: 1.5,
    carbsG: 7,
    fatG: 0.2,
    tags: ["fiber", "light"],
  },
];

const DEFAULT_PROFILE: Profile = {
  sex: "female",
  age: 19,
  heightCm: 160,
  weightKg: 55,
  activity: "moderate",
  goal: "maintain",
  proteinPerKg: 1.6,
  fatPercent: 25,
};

/* ---------------- Storage ---------------- */
function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error("no-state");
    const parsed = JSON.parse(raw) as AppState;

    if (!parsed.profile || !parsed.foods || !parsed.diary) throw new Error("bad-state");

    return {
      ...parsed,
      selectedDateISO: parsed.selectedDateISO || todayISO(),
    };
  } catch {
    return {
      profile: DEFAULT_PROFILE,
      foods: DEFAULT_FOODS,
      diary: [],
      selectedDateISO: todayISO(),
    };
  }
}

function saveState(s: AppState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

/* ============================ Component ============================ */
export function NutritionTab() {
  const [state, setState] = useState<AppState>(() => loadState());

  const [query, setQuery] = useState("");
  const [selectedFoodId, setSelectedFoodId] = useState<string | null>(null);
  const [qty, setQty] = useState<number>(100);
  const [meal, setMeal] = useState<DiaryEntry["meal"]>("lunch");

  const [showAddFood, setShowAddFood] = useState(false);
  const [newFood, setNewFood] = useState<Omit<FoodItem, "id">>({
    name: "",
    mode: "per100g",
    baseAmount: 100,
    unitLabel: "g",
    calories: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    tags: [],
  });

  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    saveState(state);
  }, [state]);

  const profile = state.profile;

  /* ---------- Targets (BMR/TDEE/Macros) ---------- */
  const computed = useMemo(() => {
    const bmr = calcBMR(profile);
    const tdee = calcTDEE(profile);

    const suggestedCalories = Math.max(1200, Math.round(tdee + goalDelta(profile.goal)));
    const targetCalories = profile.targetCalories ?? suggestedCalories;

    const proteinG = Math.max(60, Math.round(profile.weightKg * profile.proteinPerKg));
    const fatCals = Math.round((targetCalories * clamp(profile.fatPercent, 15, 35)) / 100);
    const fatG = Math.max(30, Math.round(fatCals / 9));

    const proteinCals = proteinG * 4;
    const remainingForCarbs = Math.max(0, targetCalories - proteinCals - fatG * 9);
    const carbsG = Math.round(remainingForCarbs / 4);

    return {
      bmr: round(bmr, 0),
      tdee: round(tdee, 0),
      targetCalories,
      suggestedCalories,
      macros: { proteinG, carbsG, fatG },
    };
  }, [profile]);

  /* ---------- Diary slices ---------- */
  const dayEntries = useMemo(() => {
    return state.diary
      .filter((e) => e.dateISO === state.selectedDateISO)
      .sort((a, b) => a.createdAt - b.createdAt);
  }, [state.diary, state.selectedDateISO]);

  const totals = useMemo(() => {
    const sum = dayEntries.reduce(
      (acc, e) => {
        acc.calories += e.calories;
        acc.proteinG += e.proteinG;
        acc.carbsG += e.carbsG;
        acc.fatG += e.fatG;
        return acc;
      },
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
    );

    return sum;
  }, [dayEntries]);

  const remaining = useMemo(() => {
    return {
      calories: Math.max(0, computed.targetCalories - totals.calories),
      proteinG: Math.max(0, computed.macros.proteinG - totals.proteinG),
      carbsG: Math.max(0, computed.macros.carbsG - totals.carbsG),
      fatG: Math.max(0, computed.macros.fatG - totals.fatG),
    };
  }, [computed, totals]);

  /* ---------- Search + selection ---------- */
  const filteredFoods = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = state.foods.slice();

    if (!q) return list.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 30);

    return list
      .filter((f) => {
        const nameHit = f.name.toLowerCase().includes(q);
        const tagHit = (f.tags || []).some((t) => t.toLowerCase().includes(q));
        return nameHit || tagHit;
      })
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 30);
  }, [state.foods, query]);

  const selectedFood = useMemo(() => {
    if (!selectedFoodId) return null;
    return state.foods.find((f) => f.id === selectedFoodId) || null;
  }, [selectedFoodId, state.foods]);

  useEffect(() => {
    if (!selectedFood) return;
    setQty(selectedFood.mode === "per100g" ? 100 : 1);
  }, [selectedFoodId]); // eslint-disable-line

  const preview = useMemo(() => {
    if (!selectedFood) return null;
    return scaleFood(selectedFood, qty);
  }, [selectedFood, qty]);

  /* ---------- Mutators ---------- */
  function updateProfile<K extends keyof Profile>(key: K, value: Profile[K]) {
    setState((s) => ({ ...s, profile: { ...s.profile, [key]: value } }));
  }

  function addEntry() {
    if (!selectedFood) return;

    const cleanQty =
      selectedFood.mode === "per100g" ? clamp(qty, 1, 2000) : clamp(qty, 0.25, 20);

    const scaled = scaleFood(selectedFood, cleanQty);

    const entry: DiaryEntry = {
      id: uid("entry"),
      dateISO: state.selectedDateISO,
      foodId: selectedFood.id,
      foodName: selectedFood.name,
      qty: cleanQty,
      unitLabel: selectedFood.unitLabel,
      calories: scaled.calories,
      proteinG: scaled.proteinG,
      carbsG: scaled.carbsG,
      fatG: scaled.fatG,
      meal,
      createdAt: Date.now(),
    };

    setState((s) => ({ ...s, diary: [...s.diary, entry] }));
  }

  function removeEntry(entryId: string) {
    setState((s) => ({ ...s, diary: s.diary.filter((e) => e.id !== entryId) }));
  }

  function clearDay() {
    setState((s) => ({ ...s, diary: s.diary.filter((e) => e.dateISO !== s.selectedDateISO) }));
  }

  function addCustomFood() {
    const name = newFood.name.trim();
    if (!name) return;

    const mode = newFood.mode;
    const item: FoodItem = {
      id: uid("food"),
      name,
      mode,
      baseAmount: mode === "per100g" ? 100 : 1,
      unitLabel: mode === "per100g" ? "g" : "serving",
      calories: clamp(Number(newFood.calories) || 0, 0, 5000),
      proteinG: clamp(Number(newFood.proteinG) || 0, 0, 500),
      carbsG: clamp(Number(newFood.carbsG) || 0, 0, 500),
      fatG: clamp(Number(newFood.fatG) || 0, 0, 500),
      tags: (newFood.tags || []).filter(Boolean),
    };

    setState((s) => ({ ...s, foods: [...s.foods, item] }));
    setShowAddFood(false);

    setNewFood({
      name: "",
      mode: "per100g",
      baseAmount: 100,
      unitLabel: "g",
      calories: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      tags: [],
    });

    setSelectedFoodId(item.id);
    setQuery(item.name);
  }

  /* ---------- Simple meal split ---------- */
  const plan = useMemo(() => {
    const c = computed.targetCalories;
    const p = computed.macros.proteinG;
    const f = computed.macros.fatG;
    const carb = computed.macros.carbsG;

    const split = {
      breakfast: 0.25,
      lunch: 0.35,
      snack: 0.15,
      dinner: 0.25,
    };

    const make = (ratio: number) => ({
      calories: Math.round(c * ratio),
      proteinG: Math.round(p * ratio),
      carbsG: Math.round(carb * ratio),
      fatG: Math.round(f * ratio),
    });

    return {
      breakfast: make(split.breakfast),
      lunch: make(split.lunch),
      snack: make(split.snack),
      dinner: make(split.dinner),
    };
  }, [computed]);

  return (
    <div className="nutri-wrap">
      <div className="nutri-top">
        <div className="nutri-hero">
          <div className="nutri-title">
            <div className="badge">Nutrition</div>
            <h2>Smart Diet Planner • Offline Calorie Tracker</h2>
            <p className="muted">
              Built for consistency: clean logging, smart targets, macro balance, and a daily dashboard that
              makes progress feel obvious.
            </p>
          </div>

          <div className="nutri-heroImages">
            {[n1, n2, n3, n4].map((src, i) => (
              <div className="nutri-heroImgCard" key={i}>
                <img src={src} alt={`Nutrition ${i + 1}`} loading="lazy" />
                <div className="nutri-heroImgOverlay" />
              </div>
            ))}
          </div>

          <div className="nutri-date">
            <label className="field">
              <span>Date</span>
              <input
                type="date"
                value={state.selectedDateISO}
                onChange={(e) =>
                  setState((s) => ({ ...s, selectedDateISO: e.target.value }))
                }
              />
            </label>
            <button
              className="btn ghost"
              onClick={() => setState((s) => ({ ...s, selectedDateISO: todayISO() }))}
            >
              Today
            </button>
          </div>
        </div>

        <div className="nutri-cards">
          <div className="card stat">
            <div className="stat-head">
              <span className="stat-label">Daily Dashboard</span>
              <span className="pill">{formatKcal(computed.targetCalories)}</span>
            </div>

            <div className="stat-big">{formatKcal(totals.calories)}</div>
            <div className="stat-sub">
              <span className="muted">Consumed</span>
              <span className="muted">•</span>
              <span className="good">Remaining: {formatKcal(remaining.calories)}</span>
            </div>

            <div className="bar">
              <div
                className="bar-fill"
                style={{
                  width: `${clamp(
                    (totals.calories / computed.targetCalories) * 100,
                    0,
                    100
                  )}%`,
                }}
              />
            </div>

            <div className="macro-grid">
              <div className="macro">
                <span className="k">Protein</span>
                <span className="v">
                  {Math.round(totals.proteinG)} / {computed.macros.proteinG}g
                </span>
              </div>
              <div className="macro">
                <span className="k">Carbs</span>
                <span className="v">
                  {Math.round(totals.carbsG)} / {computed.macros.carbsG}g
                </span>
              </div>
              <div className="macro">
                <span className="k">Fat</span>
                <span className="v">
                  {Math.round(totals.fatG)} / {computed.macros.fatG}g
                </span>
              </div>
            </div>
          </div>

          <div className="card stat">
            <div className="stat-head">
              <span className="stat-label">Metabolism</span>
              <span className="pill subtle">BMR + TDEE</span>
            </div>

            <div className="split">
              <div>
                <div className="small">BMR</div>
                <div className="big">{Math.round(computed.bmr)} kcal</div>
              </div>
              <div>
                <div className="small">TDEE</div>
                <div className="big">{Math.round(computed.tdee)} kcal</div>
              </div>
            </div>

            <p className="muted mini">
              Your daily target is based on TDEE + goal. Want full control? Set a custom target below.
            </p>
          </div>

          <div className="card stat">
            <div className="stat-head">
              <span className="stat-label">Suggested Meal Split</span>
              <span className="pill subtle">Guideline</span>
            </div>

            <div className="meal-plan">
              {(["breakfast", "lunch", "snack", "dinner"] as const).map((m) => (
                <div key={m} className="meal-row">
                  <div className="meal-name">{mealLabel(m)}</div>
                  <div className="meal-m">
                    <span>{plan[m].calories} kcal</span>
                    <span className="dot">•</span>
                    <span>P {plan[m].proteinG}g</span>
                    <span className="dot">•</span>
                    <span>C {plan[m].carbsG}g</span>
                    <span className="dot">•</span>
                    <span>F {plan[m].fatG}g</span>
                  </div>
                </div>
              ))}
            </div>

            <p className="muted mini">
              Use this to structure your day — not to stress your day.
            </p>
          </div>
        </div>
      </div>

      <div className="nutri-main">
        {/* Left: Profile */}
        <div className="card panel">
          <div className="panel-head">
            <h3>Profile & Targets</h3>
            <span className="pill subtle">Personalized</span>
          </div>

          <div className="grid two">
            <label className="field">
              <span>Sex</span>
              <select
              className="options"
                value={profile.sex}
                onChange={(e) => updateProfile("sex", e.target.value as Sex)}
              >
                <option value="female">Female</option>
                <option value="male">Male</option>
              </select>
            </label>

            <label className="field">
              <span>Goal</span>
              <select
              className="options"
                value={profile.goal}
                onChange={(e) => updateProfile("goal", e.target.value as Goal)}
              >
                <option value="lose">Lose fat</option>
                <option value="maintain">Maintain</option>
                <option value="gain">Gain muscle</option>
              </select>
            </label>

            <label className="field">
              <span>Age</span>
              <input
                type="number"
                value={profile.age}
                min={10}
                max={90}
                onChange={(e) =>
                  updateProfile("age", clamp(Number(e.target.value) || 0, 10, 90))
                }
              />
            </label>

            <label className="field">
              <span>Height (cm)</span>
              <input
                type="number"
                value={profile.heightCm}
                min={120}
                max={220}
                onChange={(e) =>
                  updateProfile(
                    "heightCm",
                    clamp(Number(e.target.value) || 0, 120, 220)
                  )
                }
              />
            </label>

            <label className="field">
              <span>Weight (kg)</span>
              <input
                type="number"
                value={profile.weightKg}
                min={25}
                max={200}
                onChange={(e) =>
                  updateProfile(
                    "weightKg",
                    clamp(Number(e.target.value) || 0, 25, 200)
                  )
                }
              />
            </label>

            <label className="field">
              <span>Activity</span>
              <select
              className="options"
                value={profile.activity}
                onChange={(e) =>
                  updateProfile("activity", e.target.value as ActivityLevel)
                }
              >
                <option value="sedentary">Sedentary (little activity)</option>
                <option value="light">Light (1–3 days/week)</option>
                <option value="moderate">Moderate (3–5 days/week)</option>
                <option value="active">Active (6–7 days/week)</option>
                <option value="very_active">Very active (hard training)</option>
              </select>
            </label>
          </div>

          <div className="divider" />

          <div className="panel-head tight">
            <h4>Advanced Targets</h4>
            <span className="muted mini">Optional fine-tuning</span>
          </div>

          <div className="grid two">
            <label className="field">
              <span>Custom Calories (optional)</span>
              <input
                type="number"
                placeholder={`${computed.suggestedCalories}`}
                value={profile.targetCalories ?? ""}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  if (v === "") updateProfile("targetCalories", undefined);
                  else updateProfile("targetCalories", clamp(Number(v) || 0, 1200, 4500));
                }}
              />
              <small className="hint">
                Leave empty to use suggested target: <b>{computed.suggestedCalories}</b> kcal
              </small>
            </label>

            <label className="field">
              <span>Protein (g per kg)</span>
              <input
                type="number"
                step={0.1}
                value={profile.proteinPerKg}
                min={1.0}
                max={2.5}
                onChange={(e) =>
                  updateProfile(
                    "proteinPerKg",
                    clamp(Number(e.target.value) || 0, 1.0, 2.5)
                  )
                }
              />
              <small className="hint">Typical range: 1.2–2.2 g/kg</small>
            </label>

            <label className="field">
              <span>Fat % of calories</span>
              <input
                type="number"
                value={profile.fatPercent}
                min={15}
                max={35}
                onChange={(e) =>
                  updateProfile(
                    "fatPercent",
                    clamp(Number(e.target.value) || 0, 15, 35)
                  )
                }
              />
              <small className="hint">Typical range: 20–30%</small>
            </label>

            <div className="field info">
              <span>Macro Targets</span>
              <div className="macro-chips">
                <span className="chip">P {computed.macros.proteinG}g</span>
                <span className="chip">C {computed.macros.carbsG}g</span>
                <span className="chip">F {computed.macros.fatG}g</span>
              </div>
              <small className="hint">
                Auto-calculated from calories + protein target + fat percentage
              </small>
            </div>
          </div>
        </div>

        {/* Right: Tracker */}
        <div className="card panel">
          <div className="panel-head">
            <h3>Food Tracker</h3>
            <div className="panel-actions">
              <button className="btn ghost" onClick={() => setShowAddFood(true)}>
                + Add Custom Food
              </button>
              <button
                className="btn danger ghost"
                onClick={clearDay}
                disabled={dayEntries.length === 0}
              >
                Clear Day
              </button>
            </div>
          </div>

          <div className="tracker">
            <div className="search">
              <label className="field">
                <span>Search food</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Try: rice, dal, paneer, banana..."
                />
              </label>

              <div className="food-list">
                {filteredFoods.map((f) => {
                  const active = f.id === selectedFoodId;
                  return (
                    <button
                      key={f.id}
                      className={`food-item ${active ? "active" : ""}`}
                      onClick={() => setSelectedFoodId(f.id)}
                      type="button"
                    >
                      <div className="food-name">{f.name}</div>
                      <div className="food-meta">
                        <span className="pill subtle">
                          {f.mode === "per100g" ? "per 100g" : "per serving"}
                        </span>
                        <span className="muted mini">{Math.round(f.calories)} kcal</span>
                      </div>
                    </button>
                  );
                })}

                {filteredFoods.length === 0 && (
                  <div className="empty small">
                    Nothing found. Add it as a custom food and it’ll stay available forever.
                  </div>
                )}
              </div>
            </div>

            <div className="logger">
              <div className="card inner">
                <div className="inner-head">
                  <h4>Quick Log</h4>
                  <span className="muted mini">Pick a food → set quantity → add</span>
                </div>

                <div className="grid two">
                  <label className="field">
                    <span>Meal</span>
                    <select
                    className="options"
                     value={meal} onChange={(e) => setMeal(e.target.value as any)}>
                      <option value="breakfast">Breakfast</option>
                      <option value="lunch">Lunch</option>
                      <option value="snack">Snack</option>
                      <option value="dinner">Dinner</option>
                    </select>
                  </label>

                  <label className="field">
                    <span>Quantity</span>
                    <input
                      type="number"
                      value={qty}
                      min={selectedFood?.mode === "perServing" ? 0.25 : 1}
                      step={selectedFood?.mode === "perServing" ? 0.25 : 10}
                      onChange={(e) => setQty(Number(e.target.value) || 0)}
                      disabled={!selectedFood}
                    />
                    <small className="hint">
                      Unit: <b>{selectedFood ? selectedFood.unitLabel : "-"}</b>
                    </small>
                  </label>
                </div>

                {selectedFood && preview && (
                  <div className="preview">
                    <div className="preview-top">
                      <div>
                        <div className="preview-name">{selectedFood.name}</div>
                        <div className="muted mini">
                          {selectedFood.mode === "per100g"
                            ? "Based on 100g values"
                            : "Based on 1 serving values"}
                        </div>
                      </div>
                      <div className="preview-kcal">{formatKcal(preview.calories)}</div>
                    </div>

                    <div className="macro-grid big">
                      <div className="macro">
                        <span className="k">Protein</span>
                        <span className="v">{round(preview.proteinG, 1)} g</span>
                      </div>
                      <div className="macro">
                        <span className="k">Carbs</span>
                        <span className="v">{round(preview.carbsG, 1)} g</span>
                      </div>
                      <div className="macro">
                        <span className="k">Fat</span>
                        <span className="v">{round(preview.fatG, 1)} g</span>
                      </div>
                    </div>
                  </div>
                )}

                <button className="btn primary" onClick={addEntry} disabled={!selectedFood}>
                  Add to Diary
                </button>
              </div>

              <div className="card inner">
                <div className="inner-head">
                  <h4>Today’s diary</h4>
                  <span className="muted mini">{dayEntries.length} items</span>
                </div>

                {dayEntries.length === 0 ? (
                  <div className="empty">
                    Your diary is empty. Log one meal and your dashboard will start filling up.
                  </div>
                ) : (
                  <div className="entries">
                    {dayEntries.map((e) => (
                      <div key={e.id} className="entry">
                        <div className="entry-left">
                          <div className="entry-name">{e.foodName}</div>
                          <div className="entry-meta">
                            <span className="pill subtle">{mealLabel(e.meal)}</span>
                            <span className="muted mini">
                              {e.qty} {e.unitLabel}
                            </span>
                          </div>
                        </div>

                        <div className="entry-right">
                          <div className="entry-kcal">{Math.round(e.calories)} kcal</div>
                          <div className="entry-macro muted mini">
                            P {Math.round(e.proteinG)}g • C {Math.round(e.carbsG)}g • F{" "}
                            {Math.round(e.fatG)}g
                          </div>
                        </div>

                        <button
                          className="icon-btn"
                          onClick={() => removeEntry(e.id)}
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="card inner">
                <div className="inner-head">
                  <h4>Remaining today</h4>
                  <span className="pill subtle">Targets</span>
                </div>

                <div className="remain-grid">
                  <div className="remain">
                    <div className="small">Calories</div>
                    <div className="big">{formatKcal(remaining.calories)}</div>
                  </div>
                  <div className="remain">
                    <div className="small">Protein</div>
                    <div className="big">{Math.round(remaining.proteinG)} g</div>
                  </div>
                  <div className="remain">
                    <div className="small">Carbs</div>
                    <div className="big">{Math.round(remaining.carbsG)} g</div>
                  </div>
                  <div className="remain">
                    <div className="small">Fat</div>
                    <div className="big">{Math.round(remaining.fatG)} g</div>
                  </div>
                </div>

                <p className="muted mini">
                  Small winning rule: hit your protein first — the rest becomes easier to manage.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add custom food modal */}
      {showAddFood && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-head">
              <h3>Add Custom Food</h3>
              <button className="icon-btn" onClick={() => setShowAddFood(false)} title="Close">
                ✕
              </button>
            </div>

            <div className="grid two">
              <label className="field">
                <span>Food name</span>
                <input
                  value={newFood.name}
                  onChange={(e) => setNewFood((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g., Poha, Idli, Homemade smoothie..."
                />
              </label>

              <label className="field">
                <span>Nutrition mode</span>
                <select
                className="options"
                  value={newFood.mode}
                  onChange={(e) =>
                    setNewFood((p) => ({
                      ...p,
                      mode: e.target.value as any,
                      baseAmount: e.target.value === "per100g" ? 100 : 1,
                      unitLabel: e.target.value === "per100g" ? "g" : "serving",
                    }))
                  }
                >
                  <option value="per100g">Per 100g</option>
                  <option value="perServing">Per serving</option>
                </select>
              </label>

              <label className="field">
                <span>Calories (base)</span>
                <input
                  type="number"
                  value={newFood.calories}
                  onChange={(e) => setNewFood((p) => ({ ...p, calories: Number(e.target.value) || 0 }))}
                />
              </label>

              <label className="field">
                <span>Protein g (base)</span>
                <input
                  type="number"
                  value={newFood.proteinG}
                  onChange={(e) => setNewFood((p) => ({ ...p, proteinG: Number(e.target.value) || 0 }))}
                />
              </label>

              <label className="field">
                <span>Carbs g (base)</span>
                <input
                  type="number"
                  value={newFood.carbsG}
                  onChange={(e) => setNewFood((p) => ({ ...p, carbsG: Number(e.target.value) || 0 }))}
                />
              </label>

              <label className="field">
                <span>Fat g (base)</span>
                <input
                  type="number"
                  value={newFood.fatG}
                  onChange={(e) => setNewFood((p) => ({ ...p, fatG: Number(e.target.value) || 0 }))}
                />
              </label>
            </div>

            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setShowAddFood(false)}>
                Cancel
              </button>
              <button className="btn primary" onClick={addCustomFood}>
                Save Food
              </button>
            </div>

            <p className="muted mini">
              “Base” means: per 100g OR per 1 serving (depending on mode). Your diary scales it automatically.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}