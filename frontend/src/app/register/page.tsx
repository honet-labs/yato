"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { 
  User as UserIcon, 
  Mail, 
  Lock, 
  Phone, 
  Send as TelegramIcon, 
  Loader2, 
  ChevronRight, 
  CheckCircle2, 
  Box, 
  ShieldCheck,
  MessageSquare,
  Smartphone,
  MessageCircle,
  ArrowLeft,
  XCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const [formData, setFormData] = useState({
    fullName: "",
    username: "",
    email: "",
    password: "",
    phoneNumber: "",
    telegramId: ""
  });

  const [otpChannel, setOtpChannel] = useState('EMAIL' as 'EMAIL' | 'WHATSAPP' | 'TELEGRAM');
  const [otpCode, setOtpCode] = useState("");

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await api.post("/auth/request-otp", {
        email: formData.email,
        phone: formData.phoneNumber,
        telegram: formData.telegramId,
        username: formData.username,
        channel: otpChannel,
        type: 'REGISTER'
      });
      setStep(3);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to send OTP. Please check your contact details.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // 1. Verify OTP
      await api.post("/auth/verify-otp", {
        email: formData.email,
        phone: formData.phoneNumber,
        telegram: formData.telegramId,
        code: otpCode,
        type: 'REGISTER'
      });

      // 2. Register User
      await api.post("/auth/register", formData);
      setStep(4);
    } catch (err: any) {
      setError(err.response?.data?.message || "OTP verification failed.");
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
        <div className="w-full max-w-[500px]">
          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-4 mb-10">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-4">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all border-2",
                  step === s ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20" :
                  step > s ? "bg-emerald-500 border-emerald-500 text-white" : "bg-white border-slate-200 text-slate-400"
                )}>
                  {step > s ? <CheckCircle2 className="w-4 h-4" /> : s}
                </div>
                {s < 3 && <div className={cn("w-12 h-0.5 rounded-full", step > s ? "bg-emerald-500" : "bg-slate-200")} />}
              </div>
            ))}
          </div>

          <motion.div 
            key={step}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-[2rem] border border-slate-100 p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
          >
            {step === 1 && (
              <form onSubmit={(e) => { e.preventDefault(); setStep(2); }} className="space-y-6">
                <div className="text-center mb-8">
                  <h1 className="page-title">Create Identity</h1>
                  <p className="text-slate-500 text-sm mt-1">Start your journey with secure infrastructure</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Full Name</label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text" required value={formData.fullName}
                        onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                        className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm focus:bg-white focus:border-blue-500 outline-none transition-all"
                        placeholder="John Doe"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Username</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">@</span>
                      <input 
                        type="text" required value={formData.username}
                        onChange={(e) => setFormData({...formData, username: e.target.value})}
                        className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-9 pr-4 py-3 text-sm focus:bg-white focus:border-blue-500 outline-none transition-all"
                        placeholder="johndoe"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Corporate Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="email" required value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm focus:bg-white focus:border-blue-500 outline-none transition-all"
                      placeholder="john@honet.web.id"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Phone Number</label>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="tel" required value={formData.phoneNumber}
                        onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                        className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm focus:bg-white focus:border-blue-500 outline-none transition-all"
                        placeholder="+62812..."
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Telegram ID</label>
                    <div className="relative">
                      <TelegramIcon className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text" required value={formData.telegramId}
                        onChange={(e) => setFormData({...formData, telegramId: e.target.value})}
                        className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm focus:bg-white focus:border-blue-500 outline-none transition-all"
                        placeholder="@johndoe"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Secure Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="password" required value={formData.password} autoComplete="new-password"
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm focus:bg-white focus:border-blue-500 outline-none transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-sm shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 group"
                >
                  Verify Contact Methods <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </form>
            )}

            {step === 2 && (
              <div className="space-y-8">
                <div className="text-center">
                  <h1 className="page-title">Security Verification</h1>
                  <p className="text-slate-500 text-sm mt-1">Choose how you want to receive your OTP</p>
                </div>

                <div className="grid gap-4">
                  {[
                    { id: 'EMAIL', label: 'Email Address', icon: Mail, value: formData.email },
                    { id: 'WHATSAPP', label: 'WhatsApp Messenger', icon: MessageCircle, value: formData.phoneNumber },
                    { id: 'TELEGRAM', label: 'Telegram Bot', icon: MessageSquare, value: formData.telegramId },
                  ].map((channel) => (
                    <button 
                      key={channel.id}
                      type="button"
                      onClick={() => setOtpChannel(channel.id as any)}
                      className={cn(
                        "w-full p-5 rounded-2xl border-2 transition-all flex items-center justify-between group",
                        otpChannel === channel.id ? "border-blue-600 bg-blue-50/30" : "border-slate-100 hover:border-slate-200 bg-white"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
                          otpChannel === channel.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"
                        )}>
                          <channel.icon className="w-6 h-6" />
                        </div>
                        <div className="text-left">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{channel.label}</p>
                          <p className="text-sm font-bold text-slate-900">{channel.value}</p>
                        </div>
                      </div>
                      <div className={cn(
                        "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                        otpChannel === channel.id ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200"
                      )}>
                        {otpChannel === channel.id && <CheckCircle2 className="w-4 h-4" />}
                      </div>
                    </button>
                  ))}
                </div>

                {error && (
                  <div className="bg-rose-50 text-rose-600 text-xs font-bold p-3 rounded-lg border border-rose-100 flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}

                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setStep(1)}
                    className="flex-1 py-4 px-6 border-2 border-slate-100 rounded-2xl text-slate-500 font-bold text-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <button 
                    onClick={handleRequestOtp}
                    disabled={isLoading}
                    className="flex-[2] bg-blue-600 text-white py-4 rounded-2xl font-bold text-sm shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                  >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Send OTP Code"}
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <form onSubmit={handleVerifyAndRegister} className="space-y-8">
                <div className="text-center">
                  <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <ShieldCheck className="w-10 h-10" />
                  </div>
                  <h1 className="page-title">Enter OTP Code</h1>
                  <p className="text-slate-500 text-sm mt-1 leading-relaxed">
                    We've sent a 6-digit verification code to your <span className="text-blue-600 font-bold">{otpChannel}</span>.
                  </p>
                </div>

                <div className="space-y-4">
                  <input 
                    type="text" 
                    required
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    className="w-full text-center text-4xl font-bold tracking-[1rem] py-5 border-2 border-slate-100 rounded-2xl bg-slate-50/50 focus:bg-white focus:border-blue-600 outline-none transition-all"
                    placeholder="000000"
                  />
                  {error && (
                    <p className="text-rose-500 text-xs font-bold text-center">{error}</p>
                  )}
                  <p className="text-center text-xs text-slate-400 font-medium">
                    Didn't receive the code? <button type="button" onClick={handleRequestOtp} className="text-blue-600 font-bold hover:underline">Resend Code</button>
                  </p>
                </div>

                <button 
                  type="submit"
                  disabled={isLoading || otpCode.length < 6}
                  className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-sm shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Complete Registration"}
                </button>
              </form>
            )}

            {step === 4 && (
              <div className="text-center space-y-8">
                <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="w-12 h-12" />
                </div>
                <div>
                  <h1 className="page-title">Identity Verified</h1>
                  <p className="text-slate-500 text-sm mt-2 leading-relaxed max-w-xs mx-auto">
                    Welcome to YATO, <span className="text-slate-900 font-bold">{formData.fullName}</span>. Your secure workspace is ready.
                  </p>
                </div>
                <div className="pt-4">
                  <Link 
                    href="/login"
                    className="w-full bg-slate-900 text-white py-4 px-12 rounded-2xl font-bold text-sm shadow-xl hover:bg-slate-800 transition-all inline-block uppercase tracking-widest"
                  >
                    Login to Console
                  </Link>
                </div>
              </div>
            )}

            {step < 4 && (
              <p className="text-center mt-10 text-sm text-slate-500">
                Already have an account? <Link href="/login" className="text-blue-600 font-bold hover:underline">Sign in</Link>
              </p>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
