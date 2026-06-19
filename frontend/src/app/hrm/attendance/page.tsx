"use client";

import { PageHeader } from "@/components/PageHeader";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { Footer } from "@/components/Footer";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  Clock,
  Briefcase,
  Coffee,
  CheckCircle2,
  AlertCircle,
  Shield,
  Laptop,
  MapPin,
  Loader2,
  Users,
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight,
  X,
  Download,
  Camera
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/language-context";
import { useIsAdmin } from "@/hooks/useIsAdmin";


const getFormattedDate = (date: any) => {
  if (!date) return "";
  if (typeof date === "string" && date.includes("T")) {
    return date.split("T")[0];
  }
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}/.test(date)) {
    return date.substring(0, 10);
  }
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function AttendancePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useLanguage();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [workNotes, setWorkNotes] = useState("");
  const [clientIp, setClientIp] = useState("192.168.201.18");
  const [selfieImage, setSelfieImage] = useState(null as string | null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState(null as MediaStream | null);
  const [selectedSelfieUrl, setSelectedSelfieUrl] = useState(null as string | null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }
      });
      setCameraStream(stream);
      setIsCameraActive(true);
      setSelfieImage(null);
      
      setTimeout(() => {
        const video = document.getElementById("selfie-video") as HTMLVideoElement;
        if (video) {
          video.srcObject = stream;
          video.play().catch(err => console.log("video play error:", err));
        }
      }, 150);
    } catch (err) {
      showToast("Cannot access camera. Please check permissions.", "error");
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    const video = document.getElementById("selfie-video") as HTMLVideoElement;
    if (video) {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        setSelfieImage(dataUrl);
        stopCamera();
      }
    }
  };

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  // Navigation tab: "terminal" | "calendar" | "admin"
  const [activeTab, setActiveTab] = useState("terminal" as "terminal" | "calendar" | "admin");
  
  // Calendar states
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth() + 1); // 1-indexed
  const [selectedDayTimesheet, setSelectedDayTimesheet] = useState(null as any | null);
  const [selectedDayDate, setSelectedDayDate] = useState(null as Date | null);

  // Admin Dashboard states
  const [selectedAdminDate, setSelectedAdminDate] = useState(getFormattedDate(new Date()));
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetch("https://api.ipify.org?format=json")
      .then((res) => res.json())
      .then((data) => setClientIp(data.ip))
      .catch(() => {
        setClientIp("192.168.201.100");
      });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { isAdmin, profile } = useIsAdmin(["HR"]);

  const startRosterDate = getFormattedDate(new Date(new Date().setDate(new Date().getDate() - 15)));
  const endRosterDate = getFormattedDate(new Date(new Date().setDate(new Date().getDate() + 15)));

  const { data: roster = [], isLoading: rosterLoading } = useQuery({
    queryKey: ["hrm", "roster", startRosterDate, endRosterDate],
    queryFn: async () => {
      const res = await api.get(`/hrm/shifts/my-roster?start=${startRosterDate}&end=${endRosterDate}`);
      return res.data;
    },
  });

  const todayStr = getFormattedDate(new Date());
  const todayShift = roster.find((s: any) => getFormattedDate(new Date(s.date)) === todayStr);

  const { data: timesheets = [], isLoading: isTimesheetsLoading, refetch: refetchTimesheets } = useQuery({
    queryKey: ["hrm", "timesheets", calendarYear, calendarMonth],
    queryFn: async () => {
      const res = await api.get(`/hrm/timesheets/my?year=${calendarYear}&month=${calendarMonth}`);
      return res.data;
    },
  });

  const todayTimesheet = timesheets.find(
    (t: any) => getFormattedDate(new Date(t.date)) === todayStr
  );

  // Fetch ALL user timesheets for a given date (Admin feature)
  const { data: adminAttendance = [], isLoading: isAdminAttendanceLoading } = useQuery({
    queryKey: ["hrm", "admin-attendance", selectedAdminDate],
    queryFn: async () => {
      const res = await api.get(`/hrm/timesheets/all?date=${selectedAdminDate}`);
      return res.data;
    },
    enabled: isAdmin,
  });

  const clockInMutation = useMutation({
    mutationFn: async (payload?: { selfie?: string }) => {
      const res = await api.post("/hrm/timesheets/clock-in", payload || {});
      return res.data;
    },
    onSuccess: () => {
      refetchTimesheets();
      queryClient.invalidateQueries({ queryKey: ["hrm"] });
      showToast("Clock-in successful!", "success");
      setSelfieImage(null);
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || "Clock-in failed", "error");
    }
  });

  const clockOutMutation = useMutation({
    mutationFn: async (payload: { notes?: string; selfie?: string }) => {
      const res = await api.post("/hrm/timesheets/clock-out", payload);
      return res.data;
    },
    onSuccess: () => {
      refetchTimesheets();
      queryClient.invalidateQueries({ queryKey: ["hrm"] });
      showToast("Clock-out successful!", "success");
      setSelfieImage(null);
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || "Clock-out failed", "error");
    }
  });

  const handleClockIn = () => {
    clockInMutation.mutate({
      selfie: selfieImage || undefined,
    });
  };

  const handleClockOut = () => {
    clockOutMutation.mutate({
      notes: workNotes,
      selfie: selfieImage || undefined,
    });
    setWorkNotes("");
  };

  const exportUserTimesheetsToCSV = () => {
    if (!timesheets || timesheets.length === 0) {
      showToast("No timesheet data available to export.", "warning");
      return;
    }

    const headers = ["Date", "Status", "Total Hours", "Notes", "Logs (Type - Time - IP - Device)"];
    const rows = timesheets.map((ts: any) => {
      const formattedDate = new Date(ts.date).toLocaleDateString("en-GB");
      const logsStr = ts.logs
        ?.map((log: any) => `${log.type} (${new Date(log.timestamp).toLocaleTimeString("en-GB")} - ${log.ipAddress} - ${log.device})`)
        .join(" | ") || "";
      return [
        formattedDate,
        ts.status,
        ts.totalHours,
        ts.notes || "-",
        `"${logsStr.replace(/"/g, '""')}"`
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((e: any[]) => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Timesheets_${calendarYear}_${calendarMonth}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Timesheet data exported successfully!", "success");
  };

  // Filtered employees for Admin View
  const filteredAttendance = adminAttendance.filter((record: any) => {
    const nameMatch = record.user.fullName?.toLowerCase().includes(searchQuery.toLowerCase());
    const emailMatch = record.user.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const divisionMatch = record.user.division?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    return nameMatch || emailMatch || divisionMatch;
  });

  // Calculate Weekly and Monthly worked hours
  const startOfWeek = (() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const start = new Date(d.setDate(diff));
    start.setHours(0, 0, 0, 0);
    return start;
  })();

  const weeklyHours = timesheets
    .filter((t: any) => new Date(t.date) >= startOfWeek)
    .reduce((acc: number, t: any) => acc + (t.totalHours || 0), 0);

  const monthlyHours = timesheets
    .reduce((acc: number, t: any) => acc + (t.totalHours || 0), 0);

  const totalEmployees = adminAttendance.length;
  const presentEmployees = adminAttendance.filter((a: any) => a.timesheet?.status === "PRESENT").length;
  const lateEmployees = adminAttendance.filter((a: any) => a.timesheet?.status === "LATE").length;
  const absentEmployees = totalEmployees - presentEmployees - lateEmployees;

  const handleTabChange = (tab: "terminal" | "calendar" | "admin") => {
    if (tab === "admin") {
      router.push("/hrm/admin-panel");
      return;
    }
    setActiveTab(tab);
    if (tab === "terminal") {
      setCalendarYear(new Date().getFullYear());
      setCalendarMonth(new Date().getMonth() + 1);
    }
  };

  return (
    <div className="flex h-screen bg-background font-sans text-[13px] text-slate-900">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <MobileNav />
        
        <main className="page-container overflow-y-auto custom-scrollbar">
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-100 pb-5">
          <div className="flex-1">
            <PageHeader 
              title="Attendance" 
              subtitle={
                activeTab === "terminal" 
                  ? "Real-time terminal, geo-whitelisted log entries, and automated lateness reporting" 
                  : activeTab === "calendar"
                  ? "Monthly timesheet grid overview, work hour metrics, and detailed attendance records"
                  : "Company-wide attendance monitoring, timesheet checks, and IP audit logs"
              } 
            />
          </div>
          <div className="bg-slate-50 border border-slate-150/60 p-1.5 rounded-2xl flex items-center gap-1.5 shadow-sm flex-wrap sm:flex-nowrap">
            <button
              onClick={() => handleTabChange("terminal")}
              className={cn(
                "px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-2",
                activeTab === "terminal"
                  ? "bg-white text-slate-800 shadow-sm border border-slate-100 font-extrabold"
                  : "text-slate-450 hover:text-slate-850 font-bold"
              )}
            >
              <Laptop className="w-3.5 h-3.5" />
              Terminal Clock
            </button>
            <button
              onClick={() => handleTabChange("calendar")}
              className={cn(
                "px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-2",
                activeTab === "calendar"
                  ? "bg-white text-slate-800 shadow-sm border border-slate-100 font-extrabold"
                  : "text-slate-450 hover:text-slate-850 font-bold"
              )}
            >
              <Calendar className="w-3.5 h-3.5" />
              My Timesheets
            </button>
            {isAdmin && (
              <button
                onClick={() => handleTabChange("admin")}
                className={cn(
                  "px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-2",
                  activeTab === "admin"
                    ? "bg-white text-slate-800 shadow-sm border border-slate-100 font-extrabold"
                    : "text-slate-450 hover:text-slate-850 font-bold"
                )}
              >
                <Users className="w-3.5 h-3.5" />
                Admin Panel
              </button>
            )}
          </div>
        </header>

        {activeTab === "terminal" ? (
          <div>
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="glass-card p-6 flex items-center gap-4 border border-slate-100/80 shadow-sm">
                <div className="bg-blue-50/50 p-3 rounded-2xl">
                  <Shield className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Network Whitelist</div>
                  <div className="text-xs font-bold text-slate-700 mt-0.5 truncate">{clientIp} (Logged)</div>
                </div>
              </div>

              <div className="glass-card p-6 flex items-center gap-4 border border-slate-100/80 shadow-sm">
                <div className="bg-amber-50/50 p-3 rounded-2xl">
                  <Briefcase className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Shift Assigned</div>
                  <div className="text-sm font-bold text-slate-850 mt-0.5">
                    {todayShift?.shiftCategory?.name || "No Scheduled Shift"}
                  </div>
                </div>
              </div>

              <div className="glass-card p-6 flex flex-col justify-between border border-slate-100/80 shadow-sm min-h-[96px]">
                <div className="flex items-center gap-4 mb-2.5">
                  <div className="bg-emerald-50/50 p-2.5 rounded-xl">
                    <CheckCircle2 className="w-5.5 h-5.5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Time Summary</div>
                    <div className="text-xs font-bold text-slate-500">Hours Logged</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 border-t border-slate-100/65 pt-2.5 text-center">
                  <div>
                    <div className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Daily</div>
                    <div className="text-[13px] font-extrabold text-slate-800 mt-0.5">{todayTimesheet ? todayTimesheet.totalHours.toFixed(1) : "0.0"}h</div>
                  </div>
                  <div className="border-l border-r border-slate-100">
                    <div className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Weekly</div>
                    <div className="text-[13px] font-extrabold text-slate-800 mt-0.5">{weeklyHours.toFixed(1)}h</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Monthly</div>
                    <div className="text-[13px] font-extrabold text-slate-800 mt-0.5">{monthlyHours.toFixed(1)}h</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              {/* Live Terminal Clock Card */}
              <div className="bg-white border border-slate-150/60 rounded-[2rem] p-6 sm:p-8 shadow-sm flex flex-col justify-between min-h-[380px] relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/30 rounded-full filter blur-3xl" />
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between z-10 relative">
                    <span className="bg-blue-50 border border-blue-100 text-blue-600 text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                      Live Terminal
                    </span>
                    <div className="flex items-center gap-1.5 text-slate-400 text-xs font-bold">
                      <MapPin className="w-3.5 h-3.5 text-slate-455" />
                      <span>Office VPN / LAN</span>
                    </div>
                  </div>

                  <div className="py-4 text-center z-10 relative">
                    <div className="text-3xl sm:text-4xl xl:text-5xl font-extrabold tracking-wider text-slate-850 font-mono bg-slate-50 border border-slate-100 inline-block px-4 py-2.5 sm:px-6 sm:py-3.5 rounded-2xl">
                      {currentTime.toLocaleTimeString("en-GB", { hour12: false })}
                    </div>
                    <div className="text-xs font-bold text-slate-400 mt-3">
                      {currentTime.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-6 border-t border-slate-100 relative z-10">
                  {todayShift?.shiftCategory && (
                    <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl space-y-1">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Shift Hours</div>
                      <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                        <span>{todayShift.shiftCategory.name}</span>
                        <span className="text-blue-600 font-mono">
                          {todayShift.shiftCategory.startTime} - {todayShift.shiftCategory.endTime}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Selfie UI Component */}
                  {(!todayTimesheet || todayTimesheet.logs.length === 0 || todayTimesheet.logs[todayTimesheet.logs.length - 1].type === "CHECK_IN" || todayTimesheet.logs[todayTimesheet.logs.length - 1].type === "CHECK_OUT") && (
                    <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          Selfie Authentication
                        </span>
                        {selfieImage && (
                          <span className="bg-emerald-50 text-emerald-600 text-[8px] font-extrabold uppercase px-2 py-0.5 rounded-full border border-emerald-100">
                            Captured
                          </span>
                        )}
                      </div>

                      {isCameraActive ? (
                        <div className="relative rounded-xl overflow-hidden aspect-video bg-slate-900 border border-slate-200">
                          <video
                            id="selfie-video"
                            className="w-full h-full object-cover"
                            style={{ transform: "scaleX(-1)" }}
                            playsInline
                            muted
                          />
                          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
                            <button
                              type="button"
                              onClick={capturePhoto}
                              className="bg-white hover:bg-slate-100 text-slate-800 text-[9px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm cursor-pointer transition-all"
                            >
                              📸 Capture
                            </button>
                            <button
                              type="button"
                              onClick={stopCamera}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-600 text-[9px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg border border-rose-200 shadow-sm cursor-pointer transition-all"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : selfieImage ? (
                        <div className="relative rounded-xl overflow-hidden aspect-video bg-slate-100 border border-slate-200">
                          <img
                            src={selfieImage}
                            alt="Selfie preview"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-2 right-2">
                            <button
                              type="button"
                              onClick={() => setSelfieImage(null)}
                              className="bg-slate-900/60 hover:bg-slate-900/80 text-white p-1.5 rounded-lg transition-all cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="absolute bottom-2 left-2">
                            <button
                              type="button"
                              onClick={startCamera}
                              className="bg-white/80 hover:bg-white text-slate-800 text-[9px] font-extrabold uppercase px-2 py-1 rounded-lg border border-slate-200 shadow-sm cursor-pointer"
                            >
                              Retake
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={startCamera}
                          className="w-full py-2.5 bg-white hover:bg-slate-100/50 border border-slate-200 text-slate-650 hover:text-slate-850 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                        >
                          <Camera className="w-4 h-4 text-slate-400" />
                          <span>Add Selfie (Optional)</span>
                        </button>
                      )}
                    </div>
                  )}

                  <div>
                    {!todayTimesheet || todayTimesheet.logs.length === 0 || todayTimesheet.logs[todayTimesheet.logs.length - 1].type === "CHECK_OUT" ? (
                      <div className="space-y-4">
                        {todayTimesheet && todayTimesheet.logs.find((l: any) => l.type === "CHECK_OUT") && (
                          <div className="bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs font-bold p-4 rounded-2xl flex items-center justify-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            <span>Shift Completed for Today! ({todayTimesheet.totalHours} hrs worked)</span>
                          </div>
                        )}
                        <button
                          onClick={handleClockIn}
                          disabled={clockInMutation.isPending}
                          className="btn-primary w-full py-4 text-xs font-black uppercase tracking-widest bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl active:scale-[0.98] shadow-md shadow-blue-500/10 cursor-pointer"
                        >
                          {clockInMutation.isPending ? "Checking In..." : "🚀 CHECK IN (PRESENT)"}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <input
                          type="text"
                          placeholder="Add daily report summary (optional)..."
                          value={workNotes}
                          onChange={(e) => setWorkNotes(e.target.value)}
                          className="input-field w-full text-xs py-2.5 bg-slate-50 border-slate-200"
                        />
                        <button
                          onClick={handleClockOut}
                          disabled={clockOutMutation.isPending}
                          className="btn-primary w-full py-4 text-xs font-black uppercase tracking-widest bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-2xl active:scale-[0.98] shadow-md shadow-amber-500/10 cursor-pointer"
                        >
                          {clockOutMutation.isPending ? "Checking Out..." : "🏁 CHECK OUT"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Today's Log History */}
              <div className="bg-white border border-slate-150/60 rounded-[2rem] p-6 sm:p-8 shadow-sm xl:col-span-2 flex flex-col justify-between min-h-[380px]">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <Laptop className="w-4.5 h-4.5 text-blue-600" />
                      <span>Today's Attendance Logs</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {todayTimesheet ? todayTimesheet.logs.length : 0} logs registered
                    </span>
                  </div>

                  <div className="space-y-3 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                    {todayTimesheet?.logs.map((log: any) => (
                      <div
                        key={log.id}
                        className="bg-slate-50/50 border border-slate-100 p-3.5 rounded-xl flex items-center justify-between text-xs hover:border-slate-200 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          {log.selfieUrl ? (
                            <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-slate-200 cursor-zoom-in hover:scale-105 transition-all shrink-0">
                              <img
                                src={log.selfieUrl}
                                alt="Selfie"
                                className="w-full h-full object-cover"
                                onClick={() => setSelectedSelfieUrl(log.selfieUrl)}
                              />
                            </div>
                          ) : (
                            <span className={cn(
                              "w-2.5 h-2.5 rounded-full shrink-0",
                              log.type === "CHECK_IN" ? "bg-blue-500" : "bg-amber-500"
                            )} />
                          )}
                          <div>
                            <div className="font-bold text-slate-800">{log.type}</div>
                            <div className="text-[10px] text-slate-400 font-medium">IP Address: {log.ipAddress}</div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-mono text-slate-700 font-bold">
                            {new Date(log.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                          <div className="text-[9px] text-slate-400 font-semibold uppercase">{log.device?.includes("Mobi") ? "Mobile" : "Desktop"}</div>
                        </div>
                      </div>
                    ))}

                    {(!todayTimesheet || todayTimesheet.logs.length === 0) && (
                      <div className="py-16 text-center text-slate-405 font-medium text-xs">
                        No attendance check logs recorded for today yet.
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-blue-50/50 border border-blue-100/50 p-4 rounded-2xl flex items-center gap-3 text-xs text-blue-800 mt-6">
                  <AlertCircle className="w-5 h-5 text-blue-600 shrink-0" />
                  <div>
                    <strong className="text-blue-900">Anti-Fraud Safeguard:</strong> All check-ins and check-outs are audited with precise location geolocation tags, user-agents, and registered office white-listed IP addresses.
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === "calendar" ? (
          <div className="bg-white border border-slate-150/60 rounded-[2rem] p-8 shadow-sm space-y-6">
            {/* Calendar Header / Navigation */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (calendarMonth === 1) {
                      setCalendarMonth(12);
                      setCalendarYear(y => y - 1);
                    } else {
                      setCalendarMonth(m => m - 1);
                    }
                  }}
                  className="bg-slate-50 border border-slate-200 hover:bg-slate-100 p-2 rounded-xl text-slate-500 hover:text-slate-900 cursor-pointer transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                <span className="text-base font-extrabold text-slate-800 font-sans tracking-tight min-w-[140px] text-center">
                  {new Date(calendarYear, calendarMonth - 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
                </span>
                
                <button
                  onClick={() => {
                    if (calendarMonth === 12) {
                      setCalendarMonth(1);
                      setCalendarYear(y => y + 1);
                    } else {
                      setCalendarMonth(m => m + 1);
                    }
                  }}
                  className="bg-slate-50 border border-slate-200 hover:bg-slate-100 p-2 rounded-xl text-slate-500 hover:text-slate-900 cursor-pointer transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-wrap gap-4 text-xs font-bold items-center">
                <button
                  onClick={exportUserTimesheetsToCSV}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer border border-emerald-250 transition-all flex items-center gap-1.5 shadow-sm mr-2"
                >
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </button>
                <span className="flex items-center gap-2 text-blue-600">
                  <span className="w-2.5 h-2.5 bg-blue-500 rounded-full" /> 
                  Present
                </span>
                <span className="flex items-center gap-2 text-amber-600">
                  <span className="w-2.5 h-2.5 bg-amber-500 rounded-full" /> 
                  Late
                </span>
                <span className="flex items-center gap-2 text-purple-600">
                  <span className="w-2.5 h-2.5 bg-purple-500 rounded-full" /> 
                  On Leave
                </span>
              </div>
            </div>

            {isTimesheetsLoading ? (
              <div className="flex flex-col items-center justify-center py-32 text-slate-400">
                <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-600" />
                <p className="text-xs font-bold uppercase tracking-widest">Loading Calendar...</p>
              </div>
            ) : (
              /* Calendar Grid */
              <div className="grid grid-cols-7 gap-3">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
                  <div key={d} className="text-center text-[10px] font-bold uppercase text-slate-400 tracking-wider py-1">
                    {d}
                  </div>
                ))}

                {/* Empty offsets */}
                {Array.from({ length: new Date(calendarYear, calendarMonth - 1, 1).getDay() - 1 }).map((_, idx) => (
                  <div key={`offset-${idx}`} className="bg-slate-50/20 border border-slate-100 rounded-2xl min-h-[95px] opacity-30" />
                ))}

                {/* Month days */}
                {Array.from({ length: new Date(calendarYear, calendarMonth, 0).getDate() }).map((_, idx) => {
                  const dayNum = idx + 1;
                  const dateObj = new Date(calendarYear, calendarMonth - 1, dayNum);
                  const dateStr = getFormattedDate(dateObj);
                  const ts = timesheets.find((t: any) => getFormattedDate(new Date(t.date)) === dateStr);

                  return (
                    <motion.div
                      key={`day-${dayNum}`}
                      whileHover={{ scale: 1.01 }}
                      onClick={() => {
                        setSelectedDayTimesheet(ts || { logs: [], totalHours: 0 });
                        setSelectedDayDate(dateObj);
                      }}
                      className={cn(
                        "bg-white border border-slate-100 rounded-2xl p-4 min-h-[105px] flex flex-col justify-between transition-all hover:bg-slate-50/50 hover:border-slate-200 shadow-sm cursor-pointer",
                        ts?.status === "PRESENT" && "border-l-4 border-l-blue-500 bg-blue-50/10",
                        ts?.status === "LATE" && "border-l-4 border-l-amber-500 bg-amber-50/10",
                        ts?.status === "ON_LEAVE" && "border-l-4 border-l-purple-500 bg-purple-50/10"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 font-mono">{dayNum}</span>
                        {ts?.status && (
                          <span className={cn(
                            "text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded",
                            ts.status === "PRESENT" && "bg-blue-50 text-blue-600 border border-blue-100",
                            ts.status === "LATE" && "bg-amber-50 text-amber-600 border border-amber-100",
                            ts.status === "ON_LEAVE" && "bg-purple-50 text-purple-600 border border-purple-100"
                          )}>
                            {ts.status}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 mt-3">
                        {(() => {
                          if (!ts) return null;
                          const hasCheckedIn = ts.logs?.some((log: any) => log.type === "CHECK_IN");
                          const hasCheckedOut = ts.logs?.some((log: any) => log.type === "CHECK_OUT");
                          const isToday = getFormattedDate(new Date(ts.date)) === getFormattedDate(new Date());
                          
                          if (hasCheckedIn && !hasCheckedOut) {
                            if (isToday) {
                              return (
                                <div className="flex items-center gap-1.5 text-[9px] font-extrabold text-emerald-600 uppercase tracking-wider">
                                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                  Active
                                </div>
                              );
                            } else {
                              return (
                                <div className="flex items-center gap-1 text-[9px] font-extrabold text-rose-500 uppercase tracking-wider">
                                  <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                  No Check-out
                                </div>
                              );
                            }
                          }
                          
                          if (ts.totalHours > 0) {
                            return (
                              <div className="text-[11px] font-mono font-bold text-slate-700">
                                {ts.totalHours} hrs
                              </div>
                            );
                          }
                          
                          return null;
                        })()}
                        {ts?.notes && (
                          <div className="text-[9px] text-slate-455 font-medium truncate max-w-[110px]" title={ts.notes}>
                            {ts.notes}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Quick Stats Grid (Admin Mode) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="glass-card p-6 flex items-center gap-4 border border-slate-100/80 shadow-sm">
                <div className="bg-slate-50 p-3 rounded-2xl">
                  <Users className="w-6 h-6 text-slate-650" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Employees</div>
                  <div className="text-xl font-black text-slate-800 mt-0.5">{totalEmployees}</div>
                </div>
              </div>

              <div className="glass-card p-6 flex items-center gap-4 border border-slate-100/80 shadow-sm">
                <div className="bg-emerald-50 p-3 rounded-2xl">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Present Today</div>
                  <div className="text-xl font-black text-slate-800 mt-0.5">{presentEmployees}</div>
                </div>
              </div>

              <div className="glass-card p-6 flex items-center gap-4 border border-slate-100/80 shadow-sm">
                <div className="bg-amber-50 p-3 rounded-2xl">
                  <AlertCircle className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Late Today</div>
                  <div className="text-xl font-black text-slate-800 mt-0.5">{lateEmployees}</div>
                </div>
              </div>

              <div className="glass-card p-6 flex items-center gap-4 border border-slate-100/80 shadow-sm">
                <div className="bg-rose-50 p-3 rounded-2xl">
                  <AlertCircle className="w-6 h-6 text-rose-600" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Absent Today</div>
                  <div className="text-xl font-black text-slate-800 mt-0.5">{absentEmployees}</div>
                </div>
              </div>
            </div>

            {/* Filter and Table Container */}
            <div className="bg-white border border-slate-150/60 rounded-[2rem] p-8 shadow-sm space-y-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-100 pb-6">
                {/* Search Bar */}
                <div className="relative w-full md:max-w-xs">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search name, email, division..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input-field w-full pl-10 text-xs py-2 bg-slate-50 border-slate-200"
                  />
                </div>

                {/* Date Picker */}
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    value={selectedAdminDate}
                    onChange={(e) => setSelectedAdminDate(e.target.value)}
                    className="input-field text-xs bg-slate-50 border-slate-200 py-1.5 px-3 cursor-pointer rounded-xl font-bold text-slate-700"
                  />
                </div>
              </div>

              {/* Table */}
              {isAdminAttendanceLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-600" />
                  <p className="text-xs font-bold uppercase tracking-widest">Fetching Attendance Data...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                        <th className="py-4 px-4">Employee</th>
                        <th className="py-4 px-4">Division</th>
                        <th className="py-4 px-4">Status</th>
                        <th className="py-4 px-4">Check-In</th>
                        <th className="py-4 px-4">Check-Out</th>
                        <th className="py-4 px-4">IP Address</th>
                        <th className="py-4 px-4">Lateness Reason / Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredAttendance.map((record: any) => {
                        const ts = record.timesheet;
                        const inLog = ts?.logs?.find((l: any) => l.type === "CHECK_IN");
                        const outLog = ts?.logs?.find((l: any) => l.type === "CHECK_OUT");

                        return (
                          <tr key={record.user.id} className="hover:bg-slate-50/40 transition-colors text-xs">
                            <td className="py-4 px-4">
                              <div className="font-extrabold text-slate-800">{record.user.fullName}</div>
                              <div className="text-[10px] text-slate-400 font-semibold">{record.user.email}</div>
                            </td>
                            <td className="py-4 px-4 text-slate-500 font-bold">{record.user.division?.name || "N/A"}</td>
                            <td className="py-4 px-4">
                              <span className={cn(
                                "text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border",
                                ts?.status === "PRESENT" && "bg-emerald-50 text-emerald-600 border-emerald-100",
                                ts?.status === "LATE" && "bg-amber-50 text-amber-600 border-amber-100",
                                (!ts || ts.status === "ABSENT") && "bg-rose-50 text-rose-600 border-rose-100"
                              )}>
                                {ts ? ts.status : "ABSENT"}
                              </span>
                            </td>
                            <td className="py-4 px-4 font-mono font-bold text-slate-700">
                              <div className="flex items-center gap-1.5">
                                <span>
                                  {inLog 
                                    ? new Date(inLog.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) 
                                    : "--:--"
                                  }
                                </span>
                                {inLog?.selfieUrl && (
                                  <button
                                    onClick={() => setSelectedSelfieUrl(inLog.selfieUrl)}
                                    className="text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                                    title="View Check-In Selfie"
                                  >
                                    <Camera className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-4 font-mono font-bold text-slate-700">
                              <div className="flex items-center gap-1.5">
                                <span>
                                  {outLog 
                                    ? new Date(outLog.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) 
                                    : "--:--"
                                  }
                                </span>
                                {outLog?.selfieUrl && (
                                  <button
                                    onClick={() => setSelectedSelfieUrl(outLog.selfieUrl)}
                                    className="text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                                    title="View Check-Out Selfie"
                                  >
                                    <Camera className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-4 font-mono text-[11px] text-slate-500">
                              {inLog?.ipAddress || "N/A"}
                            </td>
                            <td className="py-4 px-4 max-w-[200px] truncate text-slate-450 font-medium" title={ts?.latenessReason || ts?.notes}>
                              {ts?.latenessReason ? (
                                <span className="text-amber-600">⚠️ {ts.latenessReason}</span>
                              ) : ts?.notes ? (
                                <span>📝 {ts.notes}</span>
                              ) : (
                                "-"
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {filteredAttendance.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-16 text-center text-slate-400 font-medium text-xs">
                            No employees found matching the search criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>

      {/* Selected Day Details Modal */}
      <AnimatePresence>
        {selectedDayTimesheet && selectedDayDate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setSelectedDayTimesheet(null);
                setSelectedDayDate(null);
              }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white border border-slate-100 rounded-[2rem] p-8 shadow-2xl overflow-hidden z-10"
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-blue-50/40 rounded-full filter blur-3xl" />
              
              {/* Close Button */}
              <button
                onClick={() => {
                  setSelectedDayTimesheet(null);
                  setSelectedDayDate(null);
                }}
                className="absolute top-6 right-6 text-slate-400 hover:text-slate-655 bg-slate-50 hover:bg-slate-100 p-2 rounded-xl transition-all cursor-pointer z-20"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="space-y-6 relative z-10">
                <div className="text-center space-y-2">
                  <span className="bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-extrabold uppercase tracking-widest px-3.5 py-1 rounded-full inline-block">
                    Attendance Details
                  </span>
                  <h3 className="text-lg font-black text-slate-800 tracking-tight">
                    {selectedDayDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </h3>
                </div>

                <div className="space-y-4">
                  {/* Check-In Details */}
                  {(() => {
                    const checkInLog = selectedDayTimesheet.logs?.find((l: any) => l.type === "CHECK_IN");
                    if (!checkInLog) return null;
                    return (
                      <div className="bg-blue-50/60 border border-blue-100 p-5 rounded-2xl space-y-3 flex items-start justify-between gap-4">
                        <div className="text-[11px] text-slate-600 font-medium space-y-1.5 pl-1 flex-1">
                          <div className="text-blue-800 font-extrabold text-xs mb-2">
                            Check-In Recorded Successfully
                          </div>
                          <p><strong className="text-slate-800">Date:</strong> {new Date(checkInLog.timestamp).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
                          <p><strong className="text-slate-800">Time:</strong> {new Date(checkInLog.timestamp).toLocaleTimeString("en-GB", { hour12: false })}</p>
                          <p><strong className="text-slate-800">IP Address:</strong> {checkInLog.ipAddress || "LAN/Office Network"}</p>
                        </div>
                        {checkInLog.selfieUrl && (
                          <div className="relative w-16 h-20 rounded-xl overflow-hidden border border-slate-200 cursor-zoom-in hover:scale-105 transition-all shrink-0 bg-slate-100">
                            <img
                              src={checkInLog.selfieUrl}
                              alt="Check-In Selfie"
                              className="w-full h-full object-cover"
                              onClick={() => setSelectedSelfieUrl(checkInLog.selfieUrl)}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Check-Out Details */}
                  {(() => {
                    const checkOutLog = selectedDayTimesheet.logs?.find((l: any) => l.type === "CHECK_OUT");
                    if (!checkOutLog) return null;
                    return (
                      <div className="bg-emerald-50/60 border border-emerald-100 p-5 rounded-2xl space-y-3 flex items-start justify-between gap-4">
                        <div className="text-[11px] text-slate-600 font-medium space-y-1.5 pl-1 flex-1">
                          <div className="text-emerald-800 font-extrabold text-xs mb-2">
                            Check-Out Recorded Successfully
                          </div>
                          <p><strong className="text-slate-800">Date:</strong> {new Date(checkOutLog.timestamp).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
                          <p><strong className="text-slate-800">Time:</strong> {new Date(checkOutLog.timestamp).toLocaleTimeString("en-GB", { hour12: false })}</p>
                          <p><strong className="text-slate-800">Total Hours:</strong> {selectedDayTimesheet.totalHours} hrs</p>
                        </div>
                        {checkOutLog.selfieUrl && (
                          <div className="relative w-16 h-20 rounded-xl overflow-hidden border border-slate-200 cursor-zoom-in hover:scale-105 transition-all shrink-0 bg-slate-100">
                            <img
                              src={checkOutLog.selfieUrl}
                              alt="Check-Out Selfie"
                              className="w-full h-full object-cover"
                              onClick={() => setSelectedSelfieUrl(checkOutLog.selfieUrl)}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Missing Check-Out Warning in Modal */}
                  {(() => {
                    const checkInLog = selectedDayTimesheet.logs?.find((l: any) => l.type === "CHECK_IN");
                    const checkOutLog = selectedDayTimesheet.logs?.find((l: any) => l.type === "CHECK_OUT");
                    if (checkInLog && !checkOutLog) {
                      const isToday = getFormattedDate(new Date(selectedDayTimesheet.date)) === getFormattedDate(new Date());
                      if (isToday) {
                        return (
                          <div className="bg-emerald-50/20 border border-emerald-100 p-5 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs font-bold">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                            <span>Currently Active / On Shift</span>
                          </div>
                        );
                      } else {
                        return (
                          <div className="bg-rose-50/50 border border-rose-100 p-5 rounded-2xl flex items-center gap-3 text-rose-800 text-xs font-bold">
                            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                            <span>Did not checkout (Forgot Checkout)</span>
                          </div>
                        );
                      }
                    }
                    return null;
                  })()}

                  {!selectedDayTimesheet.logs?.length && (
                    <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl flex items-center justify-center text-slate-400 font-semibold text-[11px]">
                      <span>No attendance activity recorded for this date.</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Lightbox / Selfie Modal */}
      <AnimatePresence>
        {selectedSelfieUrl && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedSelfieUrl(null)}
              className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative max-w-sm w-full bg-white rounded-3xl overflow-hidden p-3 shadow-2xl z-[110]"
            >
              <button
                onClick={() => setSelectedSelfieUrl(null)}
                className="absolute top-6 right-6 bg-slate-900/60 hover:bg-slate-900/80 text-white p-2 rounded-xl transition-all cursor-pointer z-[120]"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="rounded-2xl overflow-hidden bg-slate-950 aspect-[3/4] max-h-[70vh]">
                <img
                  src={selectedSelfieUrl}
                  alt="Attendance Selfie"
                  className="w-full h-full object-contain"
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
