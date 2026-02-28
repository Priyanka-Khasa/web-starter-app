import React, { useEffect, useMemo, useState } from "react";
import { initSDK, getAccelerationMode } from "./runanywhere";

import { LoginPage } from "./components/LoginPage";

import { ChatTab } from "./components/ChatTab";
import { VoiceTab } from "./components/VoiceTab";
import { NutritionTab } from "./components/NutritionTab";
import { PostureTab } from "./components/PostureTab";
import { WorkoutsTab } from "./components/WorkoutTab";
import { ExerciseLibraryTab } from "./components/ExerciseLibraryTab"; // Renamed from ShortsTab
import { PlanTab } from "./components/PlanTab";
import { DashboardTab } from "./components/DashboardTab";

import { OnboardingWizard, hasOnboarding, OnboardingData } from "./components/OnboardingWizard";

type Tab = "dashboard" | "chat" | "voice" | "nutrition" | "posture" | "workouts" | "exercises" | "plan";

/* ----------------------------- Icons (no libs) ---------------------------- */

function IconHome() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" className="ic" aria-hidden="true">
      <path fill="currentColor" d="M12 3l9 8h-3v10h-5v-6H11v6H6V11H3l9-8Z" />
    </svg>
  );
}

function IconChat() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" className="ic" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 3c5.1 0 9 3.6 9 8c0 4.4-3.9 8-9 8c-1.1 0-2.2-.2-3.2-.5L4 21l1.6-3.9C4.6 15.8 3 13.9 3 11c0-4.4 3.9-8 9-8Zm-5 8h10v2H7v-2Zm0-4h10v2H7V7Z"
      />
    </svg>
  );
}

function IconMic() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" className="ic" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm7-3a7 7 0 0 1-14 0H3a9 9 0 0 0 8 8.94V22h2v-2.06A9 9 0 0 0 21 11h-2Z"
      />
    </svg>
  );
}

function IconFood() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" className="ic" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 3h2v8a2 2 0 0 0 2 2v8H6v-8a4 4 0 0 1-2-3.5V3Zm7 0h2v18h-2V3Zm5 0h2v6a3 3 0 0 1-2 2.8V21h-2V11.8A3 3 0 0 1 16 9V3Z"
      />
    </svg>
  );
}

function IconPosture() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" className="ic" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2a2 2 0 1 1 0 4a2 2 0 0 1 0-4Zm-1 6h2v3.2l2.3 2.3l-1.4 1.4L11 12V8Zm-4.5 2.5l1.4 1.4L6.3 13.5l-1.4-1.4L6.5 10.5Zm11 0l1.6 1.6l-1.4 1.4l-1.6-1.6l1.4-1.4ZM8 22v-2h8v2H8Z"
      />
    </svg>
  );
}

function IconDumbbell() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" className="ic" aria-hidden="true">
      <path
        fill="currentColor"
        d="M21 10v4h-2v2h-3v-2H8v2H5v-2H3v-4h2V8h3v2h8V8h3v2h2ZM7 10H6v4h1v-4Zm12 0h-1v4h1v-4Z"
      />
    </svg>
  );
}

function IconExercises() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" className="ic" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2V7zm0 8h2v2h-2v-2z"
      />
    </svg>
  );
}

function IconPlan() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" className="ic" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7 2h2v2h6V2h2v2h3v18H4V4h3V2Zm13 6H6v12h14V8ZM8 10h4v4H8v-4Zm6 0h4v2h-4v-2Zm0 4h4v2h-4v-2Z"
      />
    </svg>
  );
}

/* ------------------------------- Helpers -------------------------------- */

function tabTitle(tab: Tab) {
  switch (tab) {
    case "dashboard":
      return "Dashboard";
    case "chat":
      return "Coach";
    case "voice":
      return "Voice";
    case "nutrition":
      return "Nutrition";
    case "posture":
      return "Posture";
    case "workouts":
      return "Workouts";
    case "exercises":
      return "Exercise Library";
    case "plan":
      return "Plan";
    default:
      return "Fitness Coach";
  }
}

function readAuth(): boolean {
  if (typeof window === "undefined") return false;
  const a = window.localStorage.getItem("fitnesscoach:auth:v1");
  const b = window.sessionStorage.getItem("fitnesscoach:auth:v1");
  return Boolean(a || b);
}

function clearAuth() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("fitnesscoach:auth:v1");
  window.sessionStorage.removeItem("fitnesscoach:auth:v1");
}

/* --------------------------------- Shell -------------------------------- */

function AppShell() {
  const [isAuthed, setIsAuthed] = useState<boolean>(() => readAuth());
  const [onboarded, setOnboarded] = useState<boolean>(() => hasOnboarding());

  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // ✅ NEW

  useEffect(() => {
    if (!isAuthed) return;

    setSdkError(null);
    setSdkReady(false);

    initSDK()
      .then(() => setSdkReady(true))
      .catch((err) => setSdkError(err instanceof Error ? err.message : String(err)));
  }, [isAuthed]);

  const accel = useMemo(() => getAccelerationMode(), []);

  if (!isAuthed) {
    return <LoginPage appName="Fitness Coach" onSuccess={() => setIsAuthed(true)} />;
  }

  if (!onboarded) {
    return (
      <OnboardingWizard
        onDone={() => {
          setOnboarded(true);
          setActiveTab("dashboard");
        }}
      />
    );
  }

  if (sdkError) {
    return <div>Initialization Error: {sdkError}</div>;
  }

  if (!sdkReady) {
    return <div className="loading-screen">Starting services...</div>;
  }

  const title = tabTitle(activeTab);

  return (
    <div className={`appLayout ${sidebarCollapsed ? "collapsed" : ""}`}>
      
      {/* ================= Sidebar ================= */}
      <aside className="sidebar">
        <div className="sidebarTop">
          <button
            className="sidebarToggle"
            onClick={() => setSidebarCollapsed((p) => !p)}
          >
            ☰
          </button>

          {!sidebarCollapsed && (
            <div className="brandBlock">
              <div className="brandTitle">Fitness Coach</div>
              <div className="brandSub">On-device AI</div>
            </div>
          )}
        </div>

        <nav className="navList">
          <NavItem icon={<IconHome />} label="Dashboard" tab="dashboard" />
          <NavItem icon={<IconChat />} label="Coach" tab="chat" />
          <NavItem icon={<IconMic />} label="Voice" tab="voice" />
          <NavItem icon={<IconFood />} label="Nutrition" tab="nutrition" />
          <NavItem icon={<IconPosture />} label="Posture" tab="posture" />
          <NavItem icon={<IconDumbbell />} label="Workouts" tab="workouts" />
          <NavItem icon={<IconExercises />} label="Exercises" tab="exercises" />
          <NavItem icon={<IconPlan />} label="Plan" tab="plan" />
        </nav>
      </aside>

      {/* ================= Main Area ================= */}
      <div className="mainArea">

        {/* ======= Stunning Top Bar ======= */}
        <header className="topbar">
          <div className="topbarLeft">
            <div className="topbarTitle">{title}</div>
          </div>

          <div className="topbarRight">
            <div className="topbarBadge">
              {accel === "webgpu" ? "WebGPU Accelerated" : "On-device AI"}
            </div>

            <button
              className="logoutBtn"
              onClick={() => {
                clearAuth();
                setIsAuthed(false);
              }}
            >
              Logout
            </button>
          </div>
        </header>

        {/* ======= Content ======= */}
        <section className="contentArea">
          {activeTab === "dashboard" && <DashboardTab />}
          {activeTab === "chat" && <ChatTab />}
          {activeTab === "voice" && <VoiceTab />}
          {activeTab === "nutrition" && <NutritionTab />}
          {activeTab === "posture" && <PostureTab />}
          {activeTab === "workouts" && <WorkoutsTab />}
          {activeTab === "exercises" && <ExerciseLibraryTab />}
          {activeTab === "plan" && <PlanTab />}
        </section>
      </div>
    </div>
  );

  function NavItem({
    icon,
    label,
    tab,
  }: {
    icon: React.ReactNode;
    label: string;
    tab: Tab;
  }) {
    return (
      <button
        className={`navItem ${activeTab === tab ? "active" : ""}`}
        onClick={() => setActiveTab(tab)}
      >
        <div className="navIcon">{icon}</div>
        {!sidebarCollapsed && <div className="navText">{label}</div>}
      </button>
    );
  }
}
export function App() {
  return <AppShell />;
}