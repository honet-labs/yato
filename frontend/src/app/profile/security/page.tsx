"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { Shield, Key, QrCode, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/Skeleton";

export default function SecurityPage() {
  const [step, setStep] = useState<"initial" | "setup" | "verify" | "completed">("initial");
  const [mfaData, setMfaData] = useState<{ secret: string; qrCode: string } | null>(null);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isInitializing, setIsInitializing] = useState(true);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.get("/auth/profile");
      if (response.data.isMfaEnabled) {
        setStep("completed");
      }
    } catch (err) {
      console.error("Failed to fetch profile", err);
    } finally {
      setIsInitializing(false);
    }
  };

  const startMfaSetup = async () => {
    setLoading(true);
    try {
      const response = await api.post("/auth/mfa/setup");
      setMfaData(response.data);
      setStep("setup");
    } catch (err) {
      setError("Failed to initialize MFA setup.");
    } finally {
      setLoading(false);
    }
  };

  const verifyMfa = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.post("/auth/mfa/verify", { token });
      if (response.data.recoveryCodes) {
        setRecoveryCodes(response.data.recoveryCodes);
      }
      setStep("completed");
    } catch (err: any) {
      setError(err.response?.data?.message || "Invalid verification code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const disableMfa = async () => {
    if (!confirm("Are you sure you want to disable MFA? This will reduce your account security.")) return;
    setLoading(true);
    try {
      await api.post("/auth/mfa/disable");
      setStep("initial");
      setToken("");
      setMfaData(null);
      setRecoveryCodes([]);
    } catch (err) {
      setError("Failed to disable MFA. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        <MobileNav />
        <main className="page-container overflow-y-auto custom-scrollbar">
        <header className="mb-10">
          <h1 className="page-title">Security & Authentication</h1>
          <p className="text-slate-400 text-[13px] font-bold uppercase tracking-widest mt-1">Manage your account security and MFA</p>
        </header>
        
        <div className="max-w-2xl">
          <div className="glass-card mb-8">
            <div className="flex items-start justify-between mb-8">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Key className="w-5 h-5 text-blue-600" />
                  Two-Factor Authentication (MFA)
                </h2>
                <p className="text-sm text-slate-500 mt-1">Add an extra layer of security to your account.</p>
              </div>
              <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${step === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                {step === 'completed' ? 'Active' : 'Disabled'}
              </div>
            </div>

            {isInitializing ? (
              <div className="py-10 flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Checking Security Status...</p>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                {step === "initial" && (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Protect your YATO account with Multi-Factor Authentication. Once enabled, you'll need to provide a code from your authenticator app (like Google Authenticator or Authy) to sign in.
                  </p>
                  <button 
                    onClick={startMfaSetup}
                    disabled={loading}
                    className="btn-primary w-full py-4 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                    Enable MFA Protection
                  </button>
                </motion.div>
              )}

              {step === "setup" && mfaData && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  className="space-y-8"
                >
                  <div className="flex flex-col items-center gap-6 p-8 bg-slate-50 rounded-2xl border border-slate-100">
                    <img src={mfaData.qrCode} alt="MFA QR Code" className="w-48 h-48 rounded-xl shadow-lg" />
                    <div className="text-center">
                      <p className="text-sm font-bold text-slate-900">Scan this QR Code</p>
                      <p className="text-xs text-slate-500 mt-1">Use your authenticator app to scan the code above.</p>
                    </div>
                    <div className="w-full p-4 bg-white rounded-xl border border-slate-200 text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Manual Setup Key</p>
                      <p className="text-sm font-mono font-bold text-blue-600 tracking-wider">{mfaData.secret}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setStep("verify")}
                    className="btn-primary w-full py-4"
                  >
                    Next: Verify Code
                  </button>
                </motion.div>
              )}

              {step === "verify" && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  className="space-y-6"
                >
                  <div className="text-center mb-8">
                    <p className="text-sm font-bold text-slate-900">Enter Verification Code</p>
                    <p className="text-xs text-slate-500 mt-1">Enter the 6-digit code from your app.</p>
                  </div>
                  <input 
                    type="text" 
                    value={token}
                    onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="input-field text-center text-2xl font-bold tracking-[0.5em] py-5"
                  />
                  {error && (
                    <div className="flex items-center gap-2 text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-100 text-xs font-bold">
                      <AlertCircle className="w-4 h-4" />
                      {error}
                    </div>
                  )}
                  <button 
                    onClick={verifyMfa}
                    disabled={loading || token.length !== 6}
                    className="btn-primary w-full py-4 flex items-center justify-center gap-2"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Confirm & Activate
                  </button>
                </motion.div>
              )}

              {step === "completed" && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }} 
                  animate={{ opacity: 1, scale: 1 }} 
                  className="space-y-6 animate-fade-in"
                >
                  <div className="text-center py-6">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 tracking-tight">MFA Activated!</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                      Your account is now protected with multi-factor authentication. You'll need your code for future sign-ins.
                    </p>
                  </div>

                  {recoveryCodes.length > 0 && (
                    <div className="p-6 bg-slate-950 text-slate-100 rounded-3xl border border-slate-900 space-y-4 shadow-xl">
                      <div className="text-center">
                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Emergency Recovery Codes</p>
                        <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                          Save these backup codes in a safe place. Each code can only be used once!
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-[11px] font-bold text-center tracking-wider max-w-md mx-auto py-2">
                        {recoveryCodes.map((code) => (
                          <div key={code} className="bg-slate-900 border border-slate-850 p-2.5 rounded-xl select-all">
                            {code}
                          </div>
                        ))}
                      </div>

                      <div className="text-center pt-2">
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(recoveryCodes.join("\n"));
                            alert("Recovery codes copied to clipboard!");
                          }}
                          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                        >
                          Copy All Codes
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-4 max-w-sm mx-auto pt-4">
                    <button 
                      onClick={() => window.location.href = '/dashboard'}
                      className="btn-secondary flex-1 py-3"
                    >
                      Return
                    </button>
                    <button 
                      onClick={disableMfa}
                      disabled={loading}
                      className="bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 font-bold text-sm px-6 py-3 rounded-2xl transition-all"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Disable MFA"}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
          </div>

          <div className="glass-card bg-slate-900 border-slate-800 text-white p-8">
            <h3 className="text-sm font-bold flex items-center gap-3 mb-4">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              Important Security Note
            </h3>
            <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
              If you lose access to your authenticator app, you will need to contact a system administrator to reset your MFA. 
              Always keep your backup codes (coming soon) in a safe place.
            </p>
          </div>
        </div>
        </main>
      </div>
    </div>
  );
}
