"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { Terminal, Lock, Mail, Loader2, Eye, EyeOff, XCircle, Box, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { useBranding } from "@/context/branding-context";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaToken, setMfaToken] = useState("");
  const router = useRouter();
  const { appName, appLogo } = useBranding();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await api.post("/auth/login/", { email, password, mfaToken });
      
      if (response.data.mfaRequired) {
        setMfaRequired(true);
        setIsLoading(false);
        return;
      }

      localStorage.setItem("yato_token", response.data.access_token);
      if (response.data.forcePasswordChange) {
        localStorage.setItem("yato_force_password_change", "true");
        router.push("/profile");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Authentication failed. Check your identity keys.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      <header className="p-6 flex items-center justify-between px-12">
        <div className="flex items-center gap-2">
          {appLogo ? (
            <img src={appLogo} alt="Logo" className="w-8 h-8 object-contain rounded-lg shadow-sm" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Box className="w-5 h-5 text-white" />
            </div>
          )}
          <span className="font-bold text-lg text-slate-900 tracking-tight">{appName}</span>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50/30">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[440px] bg-white rounded-2xl border border-slate-100 p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
        >
          <div className="text-center mb-10">
            <h1 className="page-title">Welcome back</h1>
            <p className="text-slate-500 text-sm mt-1">Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Email address</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="email" 
                  required
                  className="w-full bg-white border border-slate-200 rounded-lg pl-11 pr-4 py-3 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all"
                  placeholder="you@example.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Secure password</label>
                <Link href="/forgot-password" className="text-[11px] font-bold text-blue-600 hover:underline">Forgot?</Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type={showPassword ? "text" : "password"} 
                  required
                  className="w-full bg-white border border-slate-200 rounded-lg pl-11 pr-11 py-3 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {mfaRequired && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-2 overflow-hidden"
              >
                <label className="text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-1.5 block">2FA Verification Code</label>
                <div className="relative">
                  <ShieldCheck className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-blue-600" />
                  <input 
                    type="text" 
                    required
                    maxLength={6}
                    className="w-full bg-blue-50/50 border border-blue-100 rounded-lg pl-11 pr-4 py-3 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all font-mono tracking-widest"
                    placeholder="000000"
                    value={mfaToken}
                    onChange={(e) => setMfaToken(e.target.value)}
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-medium">Please enter the 6-digit code from your authenticator app.</p>
              </motion.div>
            )}

            {error && (
              <div className="bg-rose-50 text-rose-600 text-xs font-bold p-3 rounded-lg border border-rose-100 flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-blue-600 text-white py-3.5 rounded-lg font-bold text-sm shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Sign in to Dashboard"}
            </button>
          </form>

          <p className="text-center mt-8 text-sm text-slate-500">
            Don't have an account? <Link href="/register" className="text-blue-600 font-bold hover:underline">Sign up</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
