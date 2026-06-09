"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { Footer } from "@/components/Footer";
import api from "@/lib/api";
import { 
  User, 
  Mail, 
  Smartphone, 
  MessageSquare, 
  ShieldCheck, 
  Loader2, 
  Save, 
  CheckCircle2,
  AlertCircle,
  AtSign
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function ProfilePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    username: "",
    phoneNumber: "",
    telegramId: "",
    emailNotificationEnabled: true,
    whatsappNotificationEnabled: true,
    telegramNotificationEnabled: true
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.get("/auth/profile");
      setFormData({
        fullName: response.data.fullName || "",
        email: response.data.email || "",
        username: response.data.username || "",
        phoneNumber: response.data.phoneNumber || "",
        telegramId: response.data.telegramId || "",
        emailNotificationEnabled: response.data.emailNotificationEnabled ?? true,
        whatsappNotificationEnabled: response.data.whatsappNotificationEnabled ?? true,
        telegramNotificationEnabled: response.data.telegramNotificationEnabled ?? true
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage({ type: "", text: "" });

    try {
      await api.put("/auth/profile", formData);
      setMessage({ type: "success", text: "Profile updated successfully!" });
    } catch (err: any) {
      setMessage({ type: "error", text: err.response?.data?.message || "Update failed." });
    } finally {
      setIsSaving(false);
    }
  };

  const showWhatsappWarning = formData.whatsappNotificationEnabled && !formData.phoneNumber.trim();
  const showTelegramWarning = formData.telegramNotificationEnabled && !formData.telegramId.trim();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white font-sans text-slate-600">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <MobileNav />
        
        <main className="flex-1 p-8 overflow-y-auto pt-24 lg:pt-8 bg-slate-50/30">
          <div className="max-w-2xl">
            <header className="mb-10">
              <h1 className="page-title">Account Settings</h1>
              <p className="text-slate-400 text-[13px] font-bold uppercase tracking-widest mt-1">Manage your identity and contact information</p>
            </header>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-sm p-10"
            >
              <form onSubmit={handleUpdate} className="space-y-8">
                {message.text && (
                  <div className={`p-4 rounded-2xl flex items-center gap-3 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                    {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    <p className="text-sm font-bold">{message.text}</p>
                  </div>
                )}

                <div className="grid gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text" required value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        className="w-full bg-slate-50/50 border border-slate-100 rounded-xl pl-11 pr-4 py-3.5 text-sm font-bold text-slate-700 focus:bg-white focus:border-blue-500 outline-none transition-all"
                        placeholder="John Doe"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Username (used for @mentions)</label>
                    <div className="relative">
                      <AtSign className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text" required value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                        className="w-full bg-slate-50/50 border border-slate-100 rounded-xl pl-11 pr-4 py-3.5 text-sm font-bold text-slate-700 focus:bg-white focus:border-blue-500 outline-none transition-all"
                        placeholder="johndoe"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 opacity-60">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email Address (Read Only)</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="email" readOnly value={formData.email}
                        className="w-full bg-slate-100 border border-slate-100 rounded-xl pl-11 pr-4 py-3.5 text-sm font-bold text-slate-400 outline-none cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                      <div className="relative">
                        <Smartphone className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                          type="tel" value={formData.phoneNumber}
                          onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                          className={cn(
                            "w-full bg-slate-50/50 border rounded-xl pl-11 pr-4 py-3.5 text-sm font-bold outline-none transition-all",
                            showWhatsappWarning 
                              ? "border-rose-300 focus:border-rose-500 text-rose-800 focus:bg-rose-50/10" 
                              : "border-slate-100 focus:border-blue-500 text-slate-700 focus:bg-white"
                          )}
                          placeholder="+628..."
                        />
                      </div>
                      {showWhatsappWarning && (
                        <p className="text-[10px] text-rose-500 font-bold ml-1 animate-pulse">
                          ⚠️ WhatsApp notifications are enabled. Phone number is required!
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Telegram ID</label>
                      <div className="relative">
                        <MessageSquare className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                          type="text" value={formData.telegramId}
                          onChange={(e) => setFormData({ ...formData, telegramId: e.target.value })}
                          className={cn(
                            "w-full bg-slate-50/50 border rounded-xl pl-11 pr-4 py-3.5 text-sm font-bold outline-none transition-all",
                            showTelegramWarning 
                              ? "border-rose-300 focus:border-rose-500 text-rose-800 focus:bg-rose-50/10" 
                              : "border-slate-100 focus:border-blue-500 text-slate-700 focus:bg-white"
                          )}
                          placeholder="username"
                        />
                      </div>
                      {showTelegramWarning && (
                        <p className="text-[10px] text-rose-500 font-bold ml-1 animate-pulse">
                          ⚠️ Telegram notifications are enabled. Telegram ID is required!
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contact Verification Alert Card */}
                {(showWhatsappWarning || showTelegramWarning) && (
                  <div className="p-5 rounded-2xl bg-amber-50/50 border border-amber-200 text-amber-800 space-y-1.5 flex items-start gap-4 shadow-sm animate-pulse">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-amber-900">Missing Notification Contact Info</p>
                      <ul className="list-disc list-inside text-[11px] font-semibold text-amber-700 mt-1 leading-relaxed">
                        {showWhatsappWarning && <li>You enabled WhatsApp alerts but your Phone Number is empty.</li>}
                        {showTelegramWarning && <li>You enabled Telegram alerts but your Telegram ID is empty.</li>}
                      </ul>
                      <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wider mt-2.5">
                        Please fill in the missing details in the fields above.
                      </p>
                    </div>
                  </div>
                )}

                {/* Notification Channels Preferences */}
                <div className="space-y-4 pt-6 border-t border-slate-100 mt-6">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Notification Preferences</label>
                  <p className="text-[11px] text-slate-500 font-semibold mb-4 leading-relaxed">
                    Choose which channels you want to receive active alerts and tickets updates.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Email Alert Toggle */}
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, emailNotificationEnabled: !formData.emailNotificationEnabled })}
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-2xl border text-left transition-all",
                        formData.emailNotificationEnabled 
                          ? "bg-indigo-50/50 border-indigo-200 text-indigo-900 shadow-sm" 
                          : "bg-slate-50/50 border-slate-100 text-slate-400"
                      )}
                    >
                      <Mail className={cn("w-5 h-5 shrink-0", formData.emailNotificationEnabled ? "text-indigo-600" : "text-slate-400")} />
                      <div>
                        <p className="text-xs font-black">Email</p>
                        <p className="text-[9px] font-bold uppercase tracking-wider mt-0.5">
                          {formData.emailNotificationEnabled ? "Enabled" : "Disabled"}
                        </p>
                      </div>
                    </button>

                    {/* WhatsApp Alert Toggle */}
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, whatsappNotificationEnabled: !formData.whatsappNotificationEnabled })}
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-2xl border text-left transition-all",
                        formData.whatsappNotificationEnabled 
                          ? "bg-emerald-50/50 border-emerald-200 text-emerald-900 shadow-sm" 
                          : "bg-slate-50/50 border-slate-100 text-slate-400"
                      )}
                    >
                      <Smartphone className={cn("w-5 h-5 shrink-0", formData.whatsappNotificationEnabled ? "text-emerald-600" : "text-slate-400")} />
                      <div>
                        <p className="text-xs font-black">WhatsApp</p>
                        <p className="text-[9px] font-bold uppercase tracking-wider mt-0.5">
                          {formData.whatsappNotificationEnabled ? "Enabled" : "Disabled"}
                        </p>
                      </div>
                    </button>

                    {/* Telegram Alert Toggle */}
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, telegramNotificationEnabled: !formData.telegramNotificationEnabled })}
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-2xl border text-left transition-all",
                        formData.telegramNotificationEnabled 
                          ? "bg-blue-50/50 border-blue-200 text-blue-900 shadow-sm" 
                          : "bg-slate-50/50 border-slate-100 text-slate-400"
                      )}
                    >
                      <MessageSquare className={cn("w-5 h-5 shrink-0", formData.telegramNotificationEnabled ? "text-blue-600" : "text-slate-400")} />
                      <div>
                        <p className="text-xs font-black">Telegram</p>
                        <p className="text-[9px] font-bold uppercase tracking-wider mt-0.5">
                          {formData.telegramNotificationEnabled ? "Enabled" : "Disabled"}
                        </p>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between border-t border-slate-50 mt-10">
                  <div className="flex items-center gap-2 text-slate-400">
                    <ShieldCheck className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">End-to-End Encrypted</span>
                  </div>
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className="bg-blue-600 text-white px-10 py-3.5 rounded-2xl font-bold text-sm shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center gap-2.5 active:scale-[0.98] disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
          
          <Footer />
        </main>
      </div>
    </div>
  );
}
