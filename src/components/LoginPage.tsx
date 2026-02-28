import React, { useMemo, useState } from "react";

type Props = {
  appName?: string;
  onSuccess: () => void;
};

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export function LoginPage({ appName = "Fitness Coach", onSuccess }: Props) {
  const [mode, setMode] = useState<"login" | "signup">("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [remember, setRemember] = useState(true);

  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    if (!isValidEmail(email)) return false;
    if (password.trim().length < 6) return false;
    if (mode === "signup" && name.trim().length < 2) return false;
    return true;
  }, [email, password, name, mode]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isValidEmail(email)) return setError("Please enter a valid email.");
    if (password.trim().length < 6) return setError("Password must be at least 6 characters.");
    if (mode === "signup" && name.trim().length < 2) return setError("Please enter your name.");

    setBusy(true);

    // Mock login/signup delay (UI realism)
    window.setTimeout(() => {
      try {
        const token = `mock_${Date.now().toString(16)}`;
        const user = {
          email: email.trim().toLowerCase(),
          name: mode === "signup" ? name.trim() : undefined,
          createdAt: Date.now(),
        };

        const storage = remember ? window.localStorage : window.sessionStorage;
        storage.setItem("fitnesscoach:auth:v1", JSON.stringify({ token, user }));

        onSuccess();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Login failed.");
      } finally {
        setBusy(false);
      }
    }, 650);
  }

  return (
    <div className="auth-page">
      <div className="auth-bg" aria-hidden="true" />

      <div className="auth-shell">
        <div className="auth-brand">
          <div className="auth-mark" />
          <div className="auth-brandText">
            <div className="auth-title">{appName}</div>
            <div className="auth-sub">Privacy-first, on-device AI coach</div>
          </div>
        </div>

        <div className="auth-card">
          <div className="auth-cardHead">
            <div className="auth-h1">{mode === "login" ? "Sign in" : "Create account"}</div>
            <div className="auth-h2">
              {mode === "login"
                ? "Welcome back. Continue to your dashboard."
                : "Create your account to save plans and history."}
            </div>
          </div>

          <div className="auth-mode">
            <button
              type="button"
              className={`auth-modeBtn ${mode === "login" ? "active" : ""}`}
              onClick={() => {
                setMode("login");
                setError(null);
              }}
            >
              Login
            </button>
            <button
              type="button"
              className={`auth-modeBtn ${mode === "signup" ? "active" : ""}`}
              onClick={() => {
                setMode("signup");
                setError(null);
              }}
            >
              Sign up
            </button>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === "signup" && (
              <label className="auth-field">
                <span>Full name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                />
              </label>
            )}

            <label className="auth-field">
              <span>Email</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@email.com"
                autoComplete="email"
              />
            </label>

            <label className="auth-field">
              <span>Password</span>
              <div className="auth-passRow">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  type={showPass ? "text" : "password"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
                <button
                  type="button"
                  className="auth-passBtn"
                  onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? "Hide password" : "Show password"}
                >
                  {showPass ? "Hide" : "Show"}
                </button>
              </div>
              <div className="auth-hint">Min 6 characters</div>
            </label>

            <div className="auth-row">
              <label className="auth-check">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span>Remember me</span>
              </label>

              <button
                type="button"
                className="auth-link"
                onClick={() => setError("Forgot password is demo-only for now.")}
              >
                Forgot password?
              </button>
            </div>

            <button className="auth-submit" type="submit" disabled={!canSubmit || busy}>
              {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </button>

            <div className="auth-legal">
              By continuing, you agree to our <span className="auth-linkText">Terms</span> and{" "}
              <span className="auth-linkText">Privacy Policy</span>.
            </div>

            <div className="auth-foot">
              <span className="auth-muted">
                Demo login: use any email + password ≥ 6 characters.
              </span>
            </div>
          </form>
        </div>

        <div className="auth-bottomNote">
          <span className="auth-pill">On-device • Private • Fast</span>
          <span className="auth-muted">
            No cloud processing required for core features.
          </span>
        </div>
      </div>
    </div>
  );
}