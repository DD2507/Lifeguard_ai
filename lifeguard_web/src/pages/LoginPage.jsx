import { useState } from "react";

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const submit = (event) => {
    event.preventDefault();
    const ok = onLogin(email.trim(), password);
    if (!ok) {
      setError("Invalid clinical ID or password");
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between px-6 py-6 md:px-12 bg-[#f8faf4]">
      <header className="w-full max-w-[1720px] mx-auto flex items-center justify-between">
        <div className="inline-flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center relative">
            <svg className="w-5 h-5 text-[#d1f34d]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M12 4v16m-8-8h16" strokeLinecap="round" />
            </svg>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#d1f34d] animate-ping opacity-75" />
          </div>
          <span className="text-2xl font-display text-slate-900">
            LifeGuard<span className="text-[#536500]">.ai</span>
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-3 px-4 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-metric shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
          </span>
          <span className="text-slate-800 font-semibold tracking-wide">SYSTEM CONNECTED</span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500">v4.2 Clinical Station</span>
        </div>
      </header>

      <main className="w-full flex-1 flex items-center justify-center py-10">
        <section className="w-full max-w-[480px]">
          <div className="w-full bg-white rounded-3xl p-8 sm:p-10 border border-slate-200 card-glow relative">
            <span className="absolute top-4 left-4 w-1.5 h-1.5 rounded-full bg-slate-300" />
            <span className="absolute top-4 right-4 w-1.5 h-1.5 rounded-full bg-slate-300" />
            <span className="absolute bottom-4 left-4 w-1.5 h-1.5 rounded-full bg-slate-300" />
            <span className="absolute bottom-4 right-4 w-1.5 h-1.5 rounded-full bg-slate-300" />
            <div className="mb-7 text-left">
              <h1 className="text-4xl sm:text-5xl font-display text-slate-900">Welcome back</h1>
              <p className="text-sm text-slate-600 mt-2">
                It&apos;s good to see you. Sign in to your clinical station.
              </p>
            </div>
            <form className="space-y-4" onSubmit={submit}>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2" htmlFor="clinical-id">
                  Email
                </label>
                <input
                  id="clinical-id"
                  className="block w-full rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 text-sm px-4 py-3.5"
                  placeholder="doctor@hospital.org"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="username"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700" htmlFor="password">
                    Password
                  </label>
                  <span className="text-xs font-medium text-slate-500">Forgot password?</span>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    className="block w-full rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-sm px-4 py-3.5 pr-11"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3.5 text-slate-400"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
              {error && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">{error}</div>}
              <button
                className="w-full rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3.5 px-4 text-sm font-metric"
                type="submit"
              >
                Log in
              </button>
              <div className="relative my-4 flex items-center justify-center">
                <div className="w-full border-t border-slate-200" />
                <span className="absolute bg-white px-3 text-xs text-slate-400">or</span>
              </div>
              <button
                type="button"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-medium py-3 px-4 text-xs"
                onClick={() => setError("Hospital SSO is not enabled in this demo. Use admin / admin123.")}
              >
                Continue with Hospital SSO / Smartcard
              </button>
              <button
                type="button"
                className="w-full rounded-xl border border-slate-200 bg-white text-slate-600 font-medium py-2.5 px-4 text-xs"
                onClick={() => setError("Passkeys are not enabled in this demo. Use admin / admin123.")}
              >
                Log in with biometric passkey
              </button>
            </form>
            <p className="mt-6 text-center text-xs text-slate-500">
              Demo login: <strong>admin</strong> / <strong>admin123</strong>
            </p>
          </div>
        </section>
      </main>
      <footer className="max-w-[1720px] mx-auto w-full flex items-center justify-between text-xs text-slate-500">
        <span>© 2026 LifeGuard AI Health Technologies Inc.</span>
        <span>HIPAA Compliant • Encrypted Clinical Station</span>
      </footer>
    </div>
  );
}
