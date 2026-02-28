import React, { useMemo, useState } from "react";

export type OnboardingData = {
  goal: "Fat loss" | "Muscle gain" | "Maintain" | "Better stamina" | "Better sleep" | "General health";
  gender: "Female" | "Male" | "Non-binary" | "Prefer not to say";
  age: number;
  heightCm: number;
  weightKg: number;
  activity: "Sedentary" | "Light" | "Moderate" | "High";
};

const STORAGE_KEY = "fitnesscoach:onboarding:v1";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function saveOnboarding(data: OnboardingData) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ data, savedAt: Date.now() }));
}

export function hasOnboarding(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.localStorage.getItem(STORAGE_KEY));
}

type Props = {
  onDone: (data: OnboardingData) => void;
};

export function OnboardingWizard({ onDone }: Props) {
  const [step, setStep] = useState(0);

  const [goal, setGoal] = useState<OnboardingData["goal"]>("Fat loss");
  const [gender, setGender] = useState<OnboardingData["gender"]>("Female");
  const [age, setAge] = useState<string>("20");
  const [heightCm, setHeightCm] = useState<string>("160");
  const [weightKg, setWeightKg] = useState<string>("55");
  const [activity, setActivity] = useState<OnboardingData["activity"]>("Moderate");

  const totalSteps = 6;

  const progressPct = useMemo(() => Math.round(((step + 1) / totalSteps) * 100), [step]);

  const stepTitle = useMemo(() => {
    switch (step) {
      case 0:
        return "Welcome";
      case 1:
        return "Your goal";
      case 2:
        return "Gender";
      case 3:
        return "Age";
      case 4:
        return "Height & Weight";
      case 5:
        return "Activity level";
      default:
        return "Onboarding";
    }
  }, [step]);

  const canNext = useMemo(() => {
    if (step === 3) {
      const a = Number(age);
      return Number.isFinite(a) && a >= 10 && a <= 90;
    }
    if (step === 4) {
      const h = Number(heightCm);
      const w = Number(weightKg);
      return Number.isFinite(h) && h >= 120 && h <= 220 && Number.isFinite(w) && w >= 25 && w <= 250;
    }
    return true;
  }, [step, age, heightCm, weightKg]);

  function next() {
    if (!canNext) return;
    setStep((s) => clamp(s + 1, 0, totalSteps - 1));
  }

  function back() {
    setStep((s) => clamp(s - 1, 0, totalSteps - 1));
  }

  function finish() {
    const data: OnboardingData = {
      goal,
      gender,
      age: Number(age),
      heightCm: Number(heightCm),
      weightKg: Number(weightKg),
      activity,
    };
    saveOnboarding(data);
    onDone(data);
  }

  return (
    <div className="ob-page">
      <div className="ob-bg" aria-hidden="true" />

      <div className="ob-shell">
        <div className="ob-left">
          <div className="ob-brand">
            <div className="ob-mark" />
            <div>
              <div className="ob-title">Fitness Coach</div>
              <div className="ob-sub">On-device • Private • Fast</div>
            </div>
          </div>

          <div className="ob-hero">
            <div className="ob-pill">Setup in 30 seconds</div>
            <h1 className="ob-h1">Let’s personalize your plan</h1>
            <p className="ob-p">
              Your answers stay on your device. This helps the app generate better workouts, nutrition tips, and
              habit guidance — without sending your data to a server.
            </p>

            <div className="ob-progress">
              <div className="ob-progressTop">
                <div className="ob-progressTitle">{stepTitle}</div>
                <div className="ob-progressPct">{progressPct}%</div>
              </div>
              <div className="ob-bar">
                <div className="ob-barFill" style={{ ["--pct" as any]: `${progressPct}%` }} />
              </div>

              <div className="ob-dots" aria-label="Progress">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <div key={i} className={`ob-dot ${i <= step ? "active" : ""}`} />
                ))}
              </div>
            </div>
          </div>

          <div className="ob-note">
            Tip: you can edit these later in <strong>Settings</strong>.
          </div>
        </div>

        <div className="ob-card">
          {/* Step content */}
          {step === 0 && (
            <div className="ob-step">
              <div className="ob-stepTitle">Why on-device AI?</div>
              <div className="ob-stepSub">
                Because your health data is personal. On-device AI means lower latency, no internet dependency, and privacy by design.
              </div>

              <div className="ob-featureGrid">
                <div className="ob-feature">
                  <div className="ob-featureTop">
                    <span className="ob-ico">⚡</span>
                    <span className="ob-featureTitle">Fast responses</span>
                  </div>
                  <div className="ob-featureSub">No waiting for servers—runs locally.</div>
                </div>

                <div className="ob-feature">
                  <div className="ob-featureTop">
                    <span className="ob-ico">🔒</span>
                    <span className="ob-featureTitle">Private</span>
                  </div>
                  <div className="ob-featureSub">Your profile stays on your device.</div>
                </div>

                <div className="ob-feature">
                  <div className="ob-featureTop">
                    <span className="ob-ico">📶</span>
                    <span className="ob-featureTitle">Works offline</span>
                  </div>
                  <div className="ob-featureSub">Great for low-network situations.</div>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="ob-step">
              <div className="ob-stepTitle">What’s your main goal?</div>
              <div className="ob-stepSub">We’ll tune recommendations based on what you want most.</div>

              <div className="ob-choiceGrid">
                {(
                  ["Fat loss", "Muscle gain", "Maintain", "Better stamina", "Better sleep", "General health"] as OnboardingData["goal"][]
                ).map((g) => (
                  <button
                    key={g}
                    type="button"
                    className={`ob-choice ${goal === g ? "active" : ""}`}
                    onClick={() => setGoal(g)}
                  >
                    <div className="ob-choiceTop">{g}</div>
                    <div className="ob-choiceSub">
                      {g === "Fat loss" && "Sustainable deficit + strength"}
                      {g === "Muscle gain" && "Progressive overload + protein"}
                      {g === "Maintain" && "Balance and consistency"}
                      {g === "Better stamina" && "Cardio + recovery"}
                      {g === "Better sleep" && "Habits + routine tuning"}
                      {g === "General health" && "All-round wellness"}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="ob-step">
              <div className="ob-stepTitle">Gender</div>
              <div className="ob-stepSub">Used only for more accurate guidance (you can skip if you want).</div>

              <div className="ob-choiceRow">
                {(["Female", "Male", "Non-binary", "Prefer not to say"] as OnboardingData["gender"][]).map((g) => (
                  <button
                    key={g}
                    type="button"
                    className={`ob-pillChoice ${gender === g ? "active" : ""}`}
                    onClick={() => setGender(g)}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="ob-step">
              <div className="ob-stepTitle">Age</div>
              <div className="ob-stepSub">We’ll tailor intensity + recovery suggestions.</div>

              <label className="ob-field">
                <span>Age (years)</span>
                <input
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  inputMode="numeric"
                  placeholder="e.g., 20"
                />
                <div className="ob-hint">Allowed: 10–90</div>
              </label>

              {!canNext && <div className="ob-error">Please enter a valid age between 10 and 90.</div>}
            </div>
          )}

          {step === 4 && (
            <div className="ob-step">
              <div className="ob-stepTitle">Height & Weight</div>
              <div className="ob-stepSub">Used for calorie and training guidance (stored locally).</div>

              <div className="ob-two">
                <label className="ob-field">
                  <span>Height (cm)</span>
                  <input
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    inputMode="numeric"
                    placeholder="e.g., 160"
                  />
                  <div className="ob-hint">120–220 cm</div>
                </label>

                <label className="ob-field">
                  <span>Weight (kg)</span>
                  <input
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    inputMode="numeric"
                    placeholder="e.g., 55"
                  />
                  <div className="ob-hint">25–250 kg</div>
                </label>
              </div>

              {!canNext && <div className="ob-error">Please enter valid height and weight.</div>}
            </div>
          )}

          {step === 5 && (
            <div className="ob-step">
              <div className="ob-stepTitle">Activity level</div>
              <div className="ob-stepSub">This helps set realistic goals and recovery.</div>

              <div className="ob-choiceGrid">
                {(["Sedentary", "Light", "Moderate", "High"] as OnboardingData["activity"][]).map((a) => (
                  <button
                    key={a}
                    type="button"
                    className={`ob-choice ${activity === a ? "active" : ""}`}
                    onClick={() => setActivity(a)}
                  >
                    <div className="ob-choiceTop">{a}</div>
                    <div className="ob-choiceSub">
                      {a === "Sedentary" && "Mostly sitting, little exercise"}
                      {a === "Light" && "1–2 workouts/week"}
                      {a === "Moderate" && "3–4 workouts/week"}
                      {a === "High" && "5+ workouts/week or active job"}
                    </div>
                  </button>
                ))}
              </div>

              <div className="ob-summary">
                <div className="ob-summaryTitle">Quick summary</div>
                <div className="ob-summaryGrid">
                  <div className="ob-kv"><div className="k">Goal</div><div className="v">{goal}</div></div>
                  <div className="ob-kv"><div className="k">Gender</div><div className="v">{gender}</div></div>
                  <div className="ob-kv"><div className="k">Age</div><div className="v">{age}</div></div>
                  <div className="ob-kv"><div className="k">Height</div><div className="v">{heightCm} cm</div></div>
                  <div className="ob-kv"><div className="k">Weight</div><div className="v">{weightKg} kg</div></div>
                  <div className="ob-kv"><div className="k">Activity</div><div className="v">{activity}</div></div>
                </div>
              </div>
            </div>
          )}

          {/* Footer buttons */}
          <div className="ob-actions">
            <button className="ob-btn ghost" type="button" onClick={back} disabled={step === 0}>
              Back
            </button>

            {step < totalSteps - 1 ? (
              <button className="ob-btn primary" type="button" onClick={next} disabled={!canNext}>
                Next
              </button>
            ) : (
              <button className="ob-btn primary" type="button" onClick={finish}>
                Finish
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}