"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { 
  Mail, 
  Lock, 
  Smartphone, 
  MessageSquare, 
  Loader2, 
  ChevronRight, 
  CheckCircle2, 
  Box, 
  ShieldCheck,
  ArrowLeft,
  KeyRound,
  Eye,
  EyeOff
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [otpChannel, setOtpChannel] = useState('EMAIL' as 'EMAIL' | 'WHATSAPP' | 'TELEGRAM');
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const handleCheckEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await api.post("/auth/check-email", { email });
      setStep(2);
    } catch (err: any) {
      setError(err.response?.data?.message || "Email not registered.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await api.post("/auth/request-otp", {
        email,
        channel: otpChannel,
        type: 'FORGOT_PASSWORD'
      });
      setStep(3);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to send OTP. Is your email correct?");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await api.post("/auth/check-otp", {
        email,
        code: otpCode,
        type: 'FORGOT_PASSWORD'
      });
      setStep(4);
    } catch (err: any) {
      setError(err.response?.data?.message || "Invalid or expired OTP code.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await api.post("/auth/reset-password", {
        email,
        code: otpCode,
        newPassword
      });
      setStep(5);
    } catch (err: any) {
      setError(err.response?.data?.message || "Password reset failed. Check your OTP code.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      <header className="p-6 flex items-center justify-between px-12">
        <Link href="/login" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Box className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg text-slate-900 tracking-tight">YATO</span>
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50/30">
        <div className="w-full max-w-[480px]">
          <motion.div 
            key={step}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[2.5rem] border border-slate-100 p-10 shadow-[0_8px_40px_rgb(0,0,0,0.06)]"
          >
            {step === 1 && (
              <form onSubmit={handleCheckEmail} className="space-y-8">
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <KeyRound className="w-8 h-8" />
                  </div>
                  <h1 className="page-title">Forgot Password</h1>
                  <p className="text-slate-500 text-sm mt-1">Enter your registered email to begin recovery</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Registered Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="email" required value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-11 pr-4 py-3.5 text-sm focus:bg-white focus:border-blue-500 outline-none transition-all"
                      placeholder="admin@yato.local"
                    />
                  </div>
                  {error && <p className="text-rose-500 text-xs font-bold mt-2">{error}</p>}
                </div>

                <button 
                  type="submit"
                  disabled={isLoading || !email}
                  className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-sm shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 group"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Continue to Verification <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>}
                </button>
              </form>
            )}

            {step === 2 && (
              <div className="space-y-8">
                <div className="text-center">
                  <h1 className="page-title">Recovery Method</h1>
                  <p className="text-slate-500 text-sm mt-1">Select channel to receive verification code</p>
                </div>

                <div className="grid gap-3">
                  {[
                    { id: 'EMAIL', label: 'Email', icon: Mail },
                    { id: 'WHATSAPP', label: 'WhatsApp', icon: Smartphone },
                    { id: 'TELEGRAM', label: 'Telegram', icon: MessageSquare },
                  ].map((channel) => (
                    <button 
                      key={channel.id}
                      onClick={() => setOtpChannel(channel.id as any)}
                      className={cn(
                        "w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between group",
                        otpChannel === channel.id ? "border-blue-600 bg-blue-50/30" : "border-slate-100 hover:border-slate-200 bg-white"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                          otpChannel === channel.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"
                        )}>
                          <channel.icon className="w-5 h-5" />
                        </div>
                        <p className="text-sm font-bold text-slate-700">{channel.label}</p>
                      </div>
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                        otpChannel === channel.id ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200"
                      )}>
                        {otpChannel === channel.id && <CheckCircle2 className="w-3 h-3" />}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-4 pt-2">
                  <button onClick={() => setStep(1)} className="p-4 border-2 border-slate-100 rounded-2xl text-slate-500 hover:bg-slate-50 transition-all"><ArrowLeft className="w-5 h-5" /></button>
                  <button 
                    onClick={handleRequestOtp}
                    disabled={isLoading}
                    className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-bold text-sm shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                  >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Send Verification Code"}
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <form onSubmit={handleCheckOtp} className="space-y-8">
                <div className="text-center">
                  <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <ShieldCheck className="w-10 h-10" />
                  </div>
                  <h1 className="page-title">Security Check</h1>
                  <p className="text-slate-500 text-sm mt-1 leading-relaxed">
                    Enter the code sent to your <span className="text-blue-600 font-bold">{otpChannel}</span>.
                  </p>
                </div>

                <div className="space-y-4">
                  <input 
                    type="text" required maxLength={6} value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    className="w-full text-center text-4xl font-bold tracking-[1rem] py-5 border-2 border-slate-100 rounded-2xl bg-slate-50/50 focus:bg-white focus:border-blue-600 outline-none transition-all"
                    placeholder="000000"
                  />
                  {error && <p className="text-rose-500 text-xs font-bold text-center">{error}</p>}
                </div>

                <button 
                  type="submit"
                  disabled={otpCode.length < 6 || isLoading}
                  className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-sm shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify Code"}
                </button>
              </form>
            )}

            {step === 4 && (
              <form onSubmit={handleResetPassword} className="space-y-8">
                <div className="text-center">
                  <h1 className="page-title">New Credentials</h1>
                  <p className="text-slate-500 text-sm mt-1">Set a new secure password for your account</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">New Secure Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type={showPassword ? "text" : "password"} 
                      required minLength={8} value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-11 pr-11 py-3.5 text-sm focus:bg-white focus:border-blue-500 outline-none transition-all"
                      placeholder="••••••••"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={isLoading || newPassword.length < 8}
                  className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-sm shadow-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save New Password"}
                </button>
              </form>
            )}

            {step === 5 && (
              <div className="text-center space-y-8">
                <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="w-12 h-12" />
                </div>
                <div>
                  <h1 className="page-title">Security Updated</h1>
                  <p className="text-slate-500 text-sm mt-2 leading-relaxed max-w-xs mx-auto">
                    Your password has been reset successfully. You can now use your new credentials to sign in.
                  </p>
                </div>
                <div className="pt-4">
                  <Link 
                    href="/login"
                    className="w-full bg-blue-600 text-white py-4 px-12 rounded-2xl font-bold text-sm shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all inline-block uppercase tracking-widest"
                  >
                    Return to Login
                  </Link>
                </div>
              </div>
            )}

            {step < 5 && (
              <p className="text-center mt-10 text-sm text-slate-500">
                Remember your password? <Link href="/login" className="text-blue-600 font-bold hover:underline">Go back</Link>
              </p>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
