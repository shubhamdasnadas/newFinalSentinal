"use client";

import { useState } from "react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Login failed");
        return;
      }
      window.location.href = "/dashboard";
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (e: string, p: string) => {
    setEmail(e);
    setPassword(p);
    setError("");
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[55%] bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 items-center justify-center p-16 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-white/5 rounded-full" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-white/5 rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/3 rounded-full" />
        </div>

        <div className="relative text-white max-w-lg">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-14">
            <div className="w-12 h-12 bg-white/15 backdrop-blur rounded-2xl flex items-center justify-center border border-white/20">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-xl tracking-tight">SecureHub</p>
              <p className="text-white/60 text-sm">Enterprise Security Platform</p>
            </div>
          </div>

          <h2 className="text-4xl font-bold mb-5 leading-tight">
            Unified security management for your organization
          </h2>
          <p className="text-white/75 text-lg leading-relaxed mb-12">
            Monitor threats, manage endpoints, and analyze firewall data — all in one place. Built for enterprise security teams.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Threat Detection",      icon: "🛡️", desc: "Real-time SentinelOne integration" },
              { label: "Firewall Analytics",    icon: "🔥", desc: "Palo Alto report visualization" },
              { label: "Multi-Organization",    icon: "🏢", desc: "Isolated per-org databases" },
              { label: "Role-Based Access",     icon: "🔐", desc: "Granular permission control" },
            ].map((f) => (
              <div key={f.label} className="bg-white/10 backdrop-blur border border-white/15 rounded-2xl p-4">
                <span className="text-2xl mb-2 block">{f.icon}</span>
                <p className="text-sm font-semibold mb-0.5">{f.label}</p>
                <p className="text-xs text-white/60">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="font-bold text-gray-900 text-lg">SecureHub</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-1.5">Welcome back</h1>
            <p className="text-gray-500 text-sm">Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="you@company.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white transition-shadow"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-11 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white transition-shadow"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Quick login credentials */}
          <div className="mt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-gray-200" />
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Quick Login</p>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => fillCredentials("superadmin@saas.com", "SuperAdmin@123")}
                className="w-full flex items-center gap-3 px-4 py-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-left transition-colors group"
              >
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-indigo-700">Super Admin</p>
                  <p className="text-xs text-gray-500 font-mono truncate">superadmin@saas.com</p>
                </div>
                <svg className="w-4 h-4 text-indigo-400 group-hover:text-indigo-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => fillCredentials("rajesh@techsecdigital.in", "Rajesh@123")}
                  className="flex items-center gap-2.5 px-3 py-2.5 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-xl text-left transition-colors group"
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold" style={{ backgroundColor: "#6366f1" }}>T</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-violet-700 truncate">TechSec Digital</p>
                    <p className="text-xs text-gray-400 font-mono truncate">Admin</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => fillCredentials("ananya@pcpl.co.in", "Ananya@123")}
                  className="flex items-center gap-2.5 px-3 py-2.5 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl text-left transition-colors group"
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold" style={{ backgroundColor: "#0ea5e9" }}>P</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-sky-700 truncate">PCPL Pvt Ltd</p>
                    <p className="text-xs text-gray-400 font-mono truncate">Admin</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
