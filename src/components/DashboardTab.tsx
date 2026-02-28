import React, { useEffect, useMemo, useRef, useState } from "react";

/* ============================== Types & Storage ============================== */

export type OnboardingData = {
  goal: "Fat loss" | "Muscle gain" | "Maintain" | "Better stamina" | "Better sleep" | "General health";
  gender: "Female" | "Male" | "Non-binary" | "Prefer not to say";
  age: number;
  heightCm: number;
  weightKg: number;
  activity: "Sedentary" | "Light" | "Moderate" | "High";
};

const ONB_KEY = "fitnesscoach:onboarding:v1";
const DASH_THEME_KEY = "fitnesscoach:dashTheme:v2";
const AVATAR_KEY = "fitnesscoach:avatar:v2";

/** Your downloaded local clips (kept in src/assets as per your screenshot) */
const LOCAL_CLIPS = [
  { id: "c1", title: "Mobility", sub: "Stretch and warm-up", src: "/src/assets/vedio4.mp4" },
  { id: "c2", title: "Cardio", sub: "Light run session", src: "/src/assets/vedio3.mp4" },
  { id: "c3", title: "Mindfulness", sub: "Breathing and calm", src: "/src/assets/vedio1.mov" },
] as const;

type DashTheme = "system" | "light" | "dark";

/* ================================ Storage ================================= */

export function readOnboarding(): OnboardingData | null {
  try {
    const raw = localStorage.getItem(ONB_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data?: OnboardingData };
    return parsed?.data ?? null;
  } catch {
    return null;
  }
}

function readTheme(): DashTheme {
  try {
    return (localStorage.getItem(DASH_THEME_KEY) as DashTheme) || "system";
  } catch {
    return "system";
  }
}

function writeTheme(t: DashTheme) {
  try {
    localStorage.setItem(DASH_THEME_KEY, t);
  } catch {}
}

function applyTheme(t: DashTheme) {
  const html = document.documentElement;
  if (t === "system") html.removeAttribute("data-dash-theme");
  else html.setAttribute("data-dash-theme", t);
}

function readAvatar(): string | null {
  try {
    return localStorage.getItem(AVATAR_KEY);
  } catch {
    return null;
  }
}

function writeAvatar(dataUrl: string | null) {
  try {
    if (!dataUrl) localStorage.removeItem(AVATAR_KEY);
    else localStorage.setItem(AVATAR_KEY, dataUrl);
  } catch {}
}

/* ================================ Helpers ================================= */

function calcBMI(heightCm: number, weightKg: number) {
  const h = heightCm / 100;
  if (!h) return 0;
  return weightKg / (h * h);
}

function bmiLabel(v: number) {
  if (!Number.isFinite(v) || v <= 0) return "—";
  if (v < 18.5) return "Underweight";
  if (v < 25) return "Normal";
  if (v < 30) return "Overweight";
  return "Obese";
}

function caloriesEstimate(data: OnboardingData) {
  const { gender, age, heightCm, weightKg, activity } = data;
  const isMale = gender === "Male";

  const bmr = isMale
    ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
    : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;

  const mult =
    activity === "Sedentary" ? 1.2 : activity === "Light" ? 1.35 : activity === "Moderate" ? 1.55 : 1.75;

  return Math.round(bmr * mult);
}

function goalTag(goal: OnboardingData["goal"]) {
  switch (goal) {
    case "Fat loss":
      return "Cut";
    case "Muscle gain":
      return "Build";
    case "Maintain":
      return "Maintain";
    case "Better stamina":
      return "Cardio base";
    case "Better sleep":
      return "Recovery";
    default:
      return "Wellness";
  }
}

function goalSuggestion(goal: OnboardingData["goal"]) {
  switch (goal) {
    case "Fat loss":
      return "Do 3 strength sessions per week and aim for daily steps. Keep meals protein forward.";
    case "Muscle gain":
      return "Train strength 4 times per week. Focus on progressive overload and consistent protein.";
    case "Maintain":
      return "Keep 3 workouts per week plus mobility. Consistency matters more than intensity.";
    case "Better stamina":
      return "Try Zone 2 cardio 3 times per week and 1 interval session. Prioritize sleep.";
    case "Better sleep":
      return "Reduce caffeine after 2pm and do a short evening walk. Keep a fixed sleep window.";
    default:
      return "Start with 3 workouts per week, simple meals, and daily steps. Build habits first.";
  }
}

function safeClamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/* ============================== UI Bits (SVG) ============================== */

function IconSun() {
  return (
    <svg className="dash-ic" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6.76 4.84 5.35 3.43 3.93 4.85l1.42 1.41 1.41-1.42ZM1 13h3v-2H1v2Zm10 10h2v-3h-2v3Zm9-10h3v-2h-3v2Zm-2.76-8.16 1.41-1.41-1.41-1.42-1.42 1.42 1.42 1.41ZM17.24 19.16l1.42 1.41 1.41-1.41-1.41-1.42-1.42 1.42ZM4.84 17.24 3.43 18.65l1.42 1.41 1.41-1.41-1.42-1.41ZM12 6a6 6 0 1 0 0 12a6 6 0 0 0 0-12Z"
      />
    </svg>
  );
}
function IconMoon() {
  return (
    <svg className="dash-ic" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12.6 2.1c-4.5 1.1-7.3 5.6-6.2 10.1c1.1 4.5 5.6 7.3 10.1 6.2c2.2-.5 4.1-1.9 5.3-3.8c-1.1.4-2.3.5-3.5.2c-3.5-.9-5.7-4.5-4.8-8c.3-1.2.9-2.3 1.7-3.1c-.6.1-1.2.2-1.8.4Z"
      />
    </svg>
  );
}
function IconSystem() {
  return (
    <svg className="dash-ic" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Zm2 0v10h12V6H6Zm-2 14h16v2H4v-2Z"
      />
    </svg>
  );
}
function IconArrowRight() {
  return (
    <svg className="dash-ic" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12 4l1.4 1.4L8.8 10H20v2H8.8l4.6 4.6L12 18l-8-7 8-7Z" />
    </svg>
  );
}

/* ============================ Local Clips Strip ============================ */

function LocalClipsStrip() {
  const [active, setActive] = useState<(typeof LOCAL_CLIPS)[number]["id"]>("c1");
  const activeItem = useMemo(() => LOCAL_CLIPS.find((x) => x.id === active)!, [active]);

  return (
    <div className="dash-clips card">
      <div className="dash-sectionHead">
        <h3>Daily Focus</h3>
        <span className="dash-badge subtle">Local animations</span>
      </div>

      <div className="dash-clipsGrid">
        <div className="dash-clipHero">
          <video
            className="dash-clipVideo"
            src={activeItem.src}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
          />
          <div className="dash-clipOverlay">
            <div className="dash-clipTitle">{activeItem.title}</div>
            <div className="dash-muted">{activeItem.sub}</div>
          </div>
        </div>

        <div className="dash-clipList" role="tablist" aria-label="Focus clips">
          {LOCAL_CLIPS.map((c) => (
            <button
              key={c.id}
              className={`dash-clipItem ${active === c.id ? "isActive" : ""}`}
              type="button"
              onClick={() => setActive(c.id)}
              role="tab"
              aria-selected={active === c.id}
            >
              <div className="dash-clipThumb">
                <video src={c.src} autoPlay loop muted playsInline preload="metadata" />
              </div>
              <div className="dash-clipText">
                <div className="dash-clipItemTitle">{c.title}</div>
                <div className="dash-muted mini">{c.sub}</div>
              </div>
              <div className="dash-clipChevron" aria-hidden="true">
                <IconArrowRight />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================ Safe Video Player ============================ */

type VideoItem = {
  id: string;
  title: string;
  minutes: number;
  level: "Beginner" | "Intermediate";
  focus: string;
  youtubeId: string;
};

const VIDEOS: VideoItem[] = [
  { id: "v1", title: "20-min Home Workout (No Equipment)", minutes: 20, level: "Beginner", focus: "Full body", youtubeId: "ml6cT4AZdqI" },
  { id: "v2", title: "15-min Mobility Routine", minutes: 15, level: "Beginner", focus: "Mobility", youtubeId: "L_xrDAtykMI" },
  { id: "v3", title: "Beginner Strength (Full Body)", minutes: 25, level: "Intermediate", focus: "Strength", youtubeId: "UItWltVZZmE" },
  { id: "v4", title: "10-min Core Finisher", minutes: 10, level: "Beginner", focus: "Core", youtubeId: "qk97w6ZmV90" },
];

function SafeVideoPlayer({ video }: { video: VideoItem }) {
  const [mode, setMode] = useState<"safe" | "embed">("safe");

  return (
    <div className="dash-videoBlock">
      {mode === "embed" ? (
        <iframe
          className="dash-iframe"
          src={`https://www.youtube.com/embed/${video.youtubeId}`}
          title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <div className="dash-videoFallback">
          <img
            className="dash-fallbackImg"
            src={`https://i.ytimg.com/vi/${video.youtubeId}/maxresdefault.jpg`}
            alt={video.title}
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`;
            }}
          />
          <div className="dash-fallbackOverlay">
            <div className="dash-fallbackTitle">{video.title}</div>
            <a className="dash-fallbackBtn" href={`https://www.youtube.com/watch?v=${video.youtubeId}`} target="_blank" rel="noreferrer">
              Open video
            </a>
          </div>
        </div>
      )}

      <div className="dash-embedToggle">
        <button className={`dash-btn ghost ${mode === "safe" ? "isActive" : ""}`} type="button" onClick={() => setMode("safe")}>
          Safe
        </button>
        <button className={`dash-btn ghost ${mode === "embed" ? "isActive" : ""}`} type="button" onClick={() => setMode("embed")}>
          Embed
        </button>
      </div>
    </div>
  );
}

/* ============================= Profile Card ============================= */

function ProfileCard({
  profile,
  stats,
}: {
  profile: OnboardingData | null;
  stats: { bmi: number; bmiLabel: string; calories: number; goalTag: string; suggestion: string } | null;
}) {
  const [avatar, setAvatar] = useState<string | null>(() => readAvatar());

  function onPickFile(file: File | null) {
    if (!file) return;
    const maxBytes = 500 * 1024;
    if (file.size > maxBytes) {
      alert("Pick an image under 500KB for local saving.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      setAvatar(dataUrl);
      writeAvatar(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="dash-profile card">
      <div className="dash-profileHead">
        <div className="dash-profileLeft">
          <div className="dash-avatarWrap">
            {avatar ? <img className="dash-avatarImg" src={avatar} alt="Profile" /> : <div className="dash-avatarFallback" aria-hidden="true" />}
            <div className="dash-avatarRing" aria-hidden="true" />
          </div>

          <div className="dash-profileMeta">
            <div className="dash-profileTitle">Your profile</div>
            <div className="dash-muted">Saved locally and editable</div>
          </div>
        </div>

        <label className="dash-uploadBtn" title="Upload profile photo">
          <input type="file" accept="image/*" onChange={(e) => onPickFile(e.target.files?.[0] ?? null)} style={{ display: "none" }} />
          Upload
        </label>
      </div>

      <div className="dash-grid">
        <div className="dash-kv">
          <div className="k">Gender</div>
          <div className="v">{profile?.gender ?? "—"}</div>
        </div>
        <div className="dash-kv">
          <div className="k">Age</div>
          <div className="v">{profile?.age ?? "—"}</div>
        </div>
        <div className="dash-kv">
          <div className="k">Height</div>
          <div className="v">{profile ? `${profile.heightCm} cm` : "—"}</div>
        </div>
        <div className="dash-kv">
          <div className="k">Weight</div>
          <div className="v">{profile ? `${profile.weightKg} kg` : "—"}</div>
        </div>
      </div>

      <div className="dash-profileFoot">
        <div className="dash-miniPill">BMI: {stats ? `${stats.bmi} (${stats.bmiLabel})` : "—"}</div>
        <div className="dash-miniPill subtle">Calories: {stats ? `${stats.calories}/day` : "—"}</div>
      </div>

      <div className="dash-miniNote">This stays on-device. Your Coach tab can use this profile to generate better plans.</div>
    </div>
  );
}

/* ============================ Page Component =============================== */

export function DashboardTab() {
  const profile = useMemo(() => readOnboarding(), []);
  const [selectedVideo, setSelectedVideo] = useState<VideoItem>(VIDEOS[0]);
  const [theme, setTheme] = useState<DashTheme>(() => readTheme());

  useEffect(() => {
    applyTheme(theme);
    writeTheme(theme);
  }, [theme]);

  const stats = useMemo(() => {
    if (!profile) return null;
    const b = calcBMI(profile.heightCm, profile.weightKg);
    const cals = caloriesEstimate(profile);
    return {
      bmi: Number.isFinite(b) ? Number(b.toFixed(1)) : 0,
      bmiLabel: bmiLabel(b),
      calories: cals,
      goalTag: goalTag(profile.goal),
      suggestion: goalSuggestion(profile.goal),
    };
  }, [profile]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return "Good morning";
    if (h >= 12 && h < 17) return "Good afternoon";
    if (h >= 17 && h < 21) return "Good evening";
    return "Welcome back";
  }, []);

  return (
    <div className="dash-wrap">
      {/* HERO */}
      <div className="dash-hero card">
        <div className="dash-heroLeft">
          <div className="dash-heroTop">
            <div>
              <div className="dash-pill">On-device • Private • Fast</div>
              <div className="dash-greet">{greeting}</div>
            </div>

            <div className="dash-theme" aria-label="Theme">
              <button className={`dash-themeBtn ${theme === "system" ? "isActive" : ""}`} onClick={() => setTheme("system")} type="button">
                <IconSystem /> System
              </button>
              <button className={`dash-themeBtn ${theme === "light" ? "isActive" : ""}`} onClick={() => setTheme("light")} type="button">
                <IconSun /> Day
              </button>
              <button className={`dash-themeBtn ${theme === "dark" ? "isActive" : ""}`} onClick={() => setTheme("dark")} type="button">
                <IconMoon /> Night
              </button>
            </div>
          </div>

          <h2 className="dash-h2">Dashboard</h2>
          <p className="dash-sub">Your plan and profile summary, stored locally on your device for privacy.</p>

          <div className="dash-kpis">
            <div className="dash-kpi">
              <div className="k">Goal</div>
              <div className="v">{profile?.goal ?? "—"}</div>
              <div className="s">{stats?.goalTag ?? ""}</div>
            </div>

            <div className="dash-kpi">
              <div className="k">BMI</div>
              <div className="v">{stats ? stats.bmi : "—"}</div>
              <div className="s">{stats ? stats.bmiLabel : ""}</div>
            </div>

            <div className="dash-kpi">
              <div className="k">Daily calories</div>
              <div className="v">{stats ? stats.calories : "—"}</div>
              <div className="s">Estimated maintenance</div>
            </div>

            <div className="dash-kpi">
              <div className="k">Activity</div>
              <div className="v">{profile?.activity ?? "—"}</div>
              <div className="s">Current baseline</div>
            </div>
          </div>

          <div className="dash-callout">
            <div className="dash-calloutTitle">Today’s suggestion</div>
            <div className="dash-calloutText">{stats?.suggestion ?? "Complete onboarding to see suggestions."}</div>
          </div>
        </div>

        <div className="dash-heroRight">
          <ProfileCard profile={profile} stats={stats} />
        </div>
      </div>

      {/* LOCAL ANIMATIONS (your downloaded videos) */}
      <LocalClipsStrip />

      {/* MAIN GRID */}
      <div className="dash-row">
        {/* LEFT: YT */
        }
        <div className="dash-col">
          <div className="card dash-section">
            <div className="dash-sectionHead">
              <h3>Recommended workouts</h3>
              <span className="dash-badge">{VIDEOS.length} picks</span>
            </div>

            <SafeVideoPlayer video={selectedVideo} />

            <div className="dash-videoMeta">
              <div>
                <div className="dash-videoTitle">{selectedVideo.title}</div>
                <div className="dash-muted">
                  {selectedVideo.minutes} min • {selectedVideo.level} • {selectedVideo.focus}
                </div>
              </div>

              <button className="dash-btn" type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                Back to top
              </button>
            </div>

            <div className="dash-videoGrid">
              {VIDEOS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={`dash-videoCard ${selectedVideo.id === v.id ? "isActive" : ""}`}
                  onClick={() => setSelectedVideo(v)}
                >
                  <div className="dash-thumb">
                    <img src={`https://i.ytimg.com/vi/${v.youtubeId}/hqdefault.jpg`} alt={v.title} loading="lazy" />
                  </div>
                  <div className="dash-videoCardText">
                    <div className="dash-videoCardTitle">{v.title}</div>
                    <div className="dash-muted mini">
                      {v.minutes} min • {v.level} • {v.focus}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Checklist and quick cards */}
        <div className="dash-col">
          <div className="card dash-section">
            <div className="dash-sectionHead">
              <h3>Today</h3>
              <span className="dash-badge subtle">Quick actions</span>
            </div>

            <div className="dash-tilesSimple">
              <div className="dash-miniCard">
                <div className="dash-miniTitle">Checklist</div>
                <ul className="dash-list">
                  <li>Steps or a short walk</li>
                  <li>Protein in meals</li>
                  <li>Water intake</li>
                  <li>Consistent sleep window</li>
                </ul>
              </div>

              <div className="dash-miniCard">
                <div className="dash-miniTitle">Progress</div>
                <div className="dash-progressBig">{stats ? stats.bmiLabel : "—"}</div>
                <div className="dash-muted">Consistency for two weeks makes the biggest visible difference.</div>
              </div>

              <div className="dash-miniCard">
                <div className="dash-miniTitle">Local and private</div>
                <div className="dash-muted">
                  Your data is stored on this device. No cloud account is required for the dashboard.
                </div>
              </div>
            </div>

            <div className="dash-note">
              Tip: if your YouTube embed is blocked, keep Safe mode. It looks clean and never breaks the dashboard.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}