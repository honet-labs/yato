"use client";

import { PageHeader } from "@/components/PageHeader";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Loader2,
  Clock,
  X,
  CheckCircle2,
  MapPin,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";


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

export default function CalendarPage() {
  const queryClient = useQueryClient();
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth() + 1); // 1-indexed
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDayTimesheet, setSelectedDayTimesheet] = useState(null as any | null);
  const [selectedDayDate, setSelectedDayDate] = useState(null as Date | null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch timesheets
  const { data: timesheets = [], isLoading: isTimesheetsLoading, refetch: refetchTimesheets } = useQuery({
    queryKey: ["hrm", "timesheets", calendarYear, calendarMonth],
    queryFn: async () => {
      const res = await api.get(`/hrm/timesheets/my?year=${calendarYear}&month=${calendarMonth}`);
      return res.data;
    },
  });

  const clockInMutation = useMutation({
    mutationFn: async (payload?: { latenessReason?: string }) => {
      const res = await api.post("/hrm/timesheets/clock-in", payload || {});
      return res.data;
    },
    onSuccess: () => {
      refetchTimesheets();
      queryClient.invalidateQueries({ queryKey: ["hrm"] });
      alert("Successfully checked in!");
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || "Failed to check in";
      alert(msg);
    }
  });

  const clockOutMutation = useMutation({
    mutationFn: async (payload?: { notes?: string }) => {
      const res = await api.post("/hrm/timesheets/clock-out", payload || {});
      return res.data;
    },
    onSuccess: () => {
      refetchTimesheets();
      queryClient.invalidateQueries({ queryKey: ["hrm"] });
      alert("Successfully checked out!");
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || "Failed to check out";
      alert(msg);
    }
  });

  const handleClockIn = () => {
    clockInMutation.mutate({});
  };

  const handleClockOut = () => {
    const notes = prompt("Add daily report summary (optional):");
    if (notes === null) return; // User cancelled
    clockOutMutation.mutate({ notes: notes.trim() || undefined });
  };

  const todayStr = getFormattedDate(new Date());
  const todayTimesheet = timesheets.find(
    (t: any) => getFormattedDate(new Date(t.date)) === todayStr
  );

  const checkInLog = todayTimesheet?.logs?.find((l: any) => l.type === "CHECK_IN");
  const checkOutLog = todayTimesheet?.logs?.find((l: any) => l.type === "CHECK_OUT");

  return (
    <div className="flex min-h-screen bg-background font-sans text-[13px] text-slate-900">
      <MobileNav />
      <Sidebar />

      <main className="page-container flex-1">
        <header className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 border-b border-slate-100 pb-5">
          <div className="flex-1">
            <PageHeader 
              title="Calendar Timesheets" 
              subtitle="Monthly timesheet grid overview, work hour metrics, and detailed attendance records" 
            />
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs uppercase tracking-wider flex items-center gap-2.5 shadow-lg shadow-blue-500/10 hover:shadow-xl transition-all cursor-pointer"
          >
            <Clock className="w-4 h-4" />
            Check-in / Check-out Panel
          </button>
        </header>

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

            <div className="flex flex-wrap gap-4 text-xs font-bold">
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
                      {ts?.totalHours > 0 && (
                        <div className="text-[11px] font-mono font-bold text-slate-700">
                          {ts.totalHours} hrs
                        </div>
                      )}
                      {ts?.notes && (
                        <div className="text-[9px] text-slate-400 font-medium truncate max-w-[110px]" title={ts.notes}>
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
      </main>

      {/* Check-in / Check-out Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
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
                onClick={() => setIsModalOpen(false)}
                className="absolute top-6 right-6 text-slate-400 hover:text-slate-650 bg-slate-50 hover:bg-slate-100 p-2 rounded-xl transition-all cursor-pointer z-20"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="space-y-6 relative z-10">
                <div className="text-center space-y-2">
                  <span className="bg-blue-50 border border-blue-100 text-blue-600 text-[10px] font-extrabold uppercase tracking-widest px-3.5 py-1 rounded-full inline-block">
                    Attendance Terminal
                  </span>
                  <h3 className="text-lg font-black text-slate-800 tracking-tight">Check-In / Check-Out Panel</h3>
                </div>

                {/* Clock */}
                <div className="bg-slate-50/80 border border-slate-100/60 rounded-2xl py-5 px-6 text-center space-y-1">
                  <div className="text-4xl font-extrabold text-slate-850 font-mono tracking-widest">
                    {currentTime.toLocaleTimeString("en-GB", { hour12: false })}
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {currentTime.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </div>
                </div>

                {/* Info and Buttons */}
                <div className="space-y-4">
                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={handleClockIn}
                      disabled={clockInMutation.isPending}
                      className="py-4 rounded-2xl text-xs font-black uppercase tracking-wider flex flex-col items-center justify-center gap-2 transition-all cursor-pointer bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/10 hover:shadow-xl hover:shadow-blue-500/20 active:scale-[0.98]"
                    >
                      <Clock className="w-5 h-5" />
                      <span>{clockInMutation.isPending ? "Checking In..." : "Check In"}</span>
                    </button>

                    <button
                      onClick={handleClockOut}
                      disabled={clockOutMutation.isPending}
                      className="py-4 rounded-2xl text-xs font-black uppercase tracking-wider flex flex-col items-center justify-center gap-2 transition-all cursor-pointer bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/10 hover:shadow-xl hover:shadow-amber-500/20 active:scale-[0.98]"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      <span>{clockOutMutation.isPending ? "Checking Out..." : "Check Out"}</span>
                    </button>
                  </div>

                  {/* Checked In / Out Details */}
                  {checkInLog && (
                    <div className="bg-blue-50/60 border border-blue-100 p-4 rounded-2xl space-y-2">
                      <div className="flex items-center gap-2 text-blue-800 font-extrabold text-xs">
                        <CheckCircle2 className="w-4.5 h-4.5 text-blue-600" />
                        <span>Check-In Recorded Successfully</span>
                      </div>
                      <div className="text-[11px] text-slate-655 font-medium space-y-1 pl-6">
                        <p><strong className="text-slate-800">Date:</strong> {new Date(checkInLog.timestamp).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
                        <p><strong className="text-slate-800">Time:</strong> {new Date(checkInLog.timestamp).toLocaleTimeString("en-GB", { hour12: false })}</p>
                        <p><strong className="text-slate-800">IP Address:</strong> {checkInLog.ipAddress || "LAN/Office Network"}</p>
                      </div>
                    </div>
                  )}

                  {checkOutLog && (
                    <div className="bg-emerald-50/60 border border-emerald-100 p-4 rounded-2xl space-y-2">
                      <div className="flex items-center gap-2 text-emerald-800 font-extrabold text-xs">
                        <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" />
                        <span>Check-Out Recorded Successfully</span>
                      </div>
                      <div className="text-[11px] text-slate-655 font-medium space-y-1 pl-6">
                        <p><strong className="text-slate-800">Date:</strong> {new Date(checkOutLog.timestamp).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
                        <p><strong className="text-slate-800">Time:</strong> {new Date(checkOutLog.timestamp).toLocaleTimeString("en-GB", { hour12: false })}</p>
                        <p><strong className="text-slate-800">Total Hours:</strong> {todayTimesheet?.totalHours || 0} hrs</p>
                      </div>
                    </div>
                  )}

                  {!checkInLog && (
                    <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex items-center gap-2.5 text-slate-400 font-semibold text-[11px]">
                      <AlertCircle className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>No attendance activity today. Please Check-in.</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                      <div className="bg-blue-50/60 border border-blue-100 p-5 rounded-2xl space-y-3">
                        <div className="text-blue-800 font-extrabold text-xs">
                          Check-In Recorded Successfully
                        </div>
                        <div className="text-[11px] text-slate-600 font-medium space-y-1.5 pl-1">
                          <p><strong className="text-slate-800">Date:</strong> {new Date(checkInLog.timestamp).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
                          <p><strong className="text-slate-800">Time:</strong> {new Date(checkInLog.timestamp).toLocaleTimeString("en-GB", { hour12: false })}</p>
                          <p><strong className="text-slate-800">IP Address:</strong> {checkInLog.ipAddress || "LAN/Office Network"}</p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Check-Out Details */}
                  {(() => {
                    const checkOutLog = selectedDayTimesheet.logs?.find((l: any) => l.type === "CHECK_OUT");
                    if (!checkOutLog) return null;
                    return (
                      <div className="bg-emerald-50/60 border border-emerald-100 p-5 rounded-2xl space-y-3">
                        <div className="text-emerald-800 font-extrabold text-xs">
                          Check-Out Recorded Successfully
                        </div>
                        <div className="text-[11px] text-slate-600 font-medium space-y-1.5 pl-1">
                          <p><strong className="text-slate-800">Date:</strong> {new Date(checkOutLog.timestamp).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
                          <p><strong className="text-slate-800">Time:</strong> {new Date(checkOutLog.timestamp).toLocaleTimeString("en-GB", { hour12: false })}</p>
                          <p><strong className="text-slate-800">Total Hours:</strong> {selectedDayTimesheet.totalHours} hrs</p>
                        </div>
                      </div>
                    );
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
    </div>
  );
}
