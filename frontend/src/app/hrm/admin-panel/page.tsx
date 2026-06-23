"use client";

import { PageHeader } from "@/components/PageHeader";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { useState, useEffect, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
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
  Settings,
  Plus,
  X,
  Edit2,
  Lock,
  ArrowRight,
  Printer,
  Download
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useBranding } from "@/context/branding-context";
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

function ManagementAdminPanelContent() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { appName, appLogo } = useBranding();
  const { t, showToast } = useLanguage();
  const [activeTab, setActiveTab] = useState("attendance" as "attendance" | "leaves");
  const currentYear = new Date().getFullYear();
  const [selectedPrintLeave, setSelectedPrintLeave] = useState(null as any | null);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "leaves" || tabParam === "attendance") {
      setActiveTab(tabParam as "attendance" | "leaves");
    }
  }, [searchParams]);

  const handlePrintLeaveForm = (leave: any) => {
    setSelectedPrintLeave(leave);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  // ATTENDANCE ADMINISTRATIVE STATES
  const [selectedAdminDate, setSelectedAdminDate] = useState(getFormattedDate(new Date()));
  const [searchQuery, setSearchQuery] = useState("");

  // LEAVE ADMINISTRATIVE STATES
  const [isAdjustingBalance, setIsAdjustingBalance] = useState(null as any | null);
  const [adjustForm, setAdjustForm] = useState({ allocated: 12, used: 0 });
  const [newLeaveType, setNewLeaveType] = useState("");

  const { isAdmin, profile, permissions: userPermissions } = useIsAdmin(["HR"]);
  
  const hasFullAdmin = isAdmin || userPermissions.includes("MANAGE_HRM");
  const hasAttendancePerm = hasFullAdmin || userPermissions.includes("MANAGE_HRM_ATTENDANCE");
  const hasLeavesPerm = hasFullAdmin || userPermissions.includes("MANAGE_HRM_LEAVES");
  const hasAnyAccess = hasAttendancePerm || hasLeavesPerm;

  useEffect(() => {
    if (!hasAttendancePerm && hasLeavesPerm && activeTab === "attendance") {
      setActiveTab("leaves");
    } else if (!hasLeavesPerm && hasAttendancePerm && activeTab === "leaves") {
      setActiveTab("attendance");
    }
  }, [hasAttendancePerm, hasLeavesPerm, activeTab]);

  // 2. Attendance Oversight Query
  const { data: adminAttendance = [], isLoading: isAdminAttendanceLoading, refetch: refetchAdminAttendance } = useQuery({
    queryKey: ["hrm", "admin-attendance", selectedAdminDate],
    queryFn: async () => {
      const res = await api.get(`/hrm/timesheets/all?date=${selectedAdminDate}`);
      return res.data;
    },
    enabled: hasAttendancePerm,
  });

  // 3. Leave Balances Oversight Query
  const { data: adminBalances = [], refetch: refetchAdminBalances } = useQuery({
    queryKey: ["hrm", "admin-balances"],
    queryFn: async () => {
      const res = await api.get("/hrm/admin/leaves/balances");
      return res.data;
    },
    enabled: hasLeavesPerm,
  });

  // 4. Leave Requests Oversight Query
  const { data: adminRequests = [], refetch: refetchAdminRequests } = useQuery({
    queryKey: ["hrm", "admin-requests"],
    queryFn: async () => {
      const res = await api.get("/hrm/admin/leaves/requests");
      return res.data;
    },
    enabled: hasLeavesPerm,
  });

  // 5. Load/Save customizable leave types from localStorage
  const [customLeaveTypes, setCustomLeaveTypes] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("yato_custom_leave_types");
      if (saved) return JSON.parse(saved);
    }
    return [
      "Annual Leave (Cuti Tahunan)",
      "Sick Leave (Sakit dengan Surat)",
      "Permit (Izin Khusus)",
      "Maternity Leave (Cuti Melahirkan)",
      "Marriage Leave (Cuti Menikah)",
    ];
  });

  useEffect(() => {
    localStorage.setItem("yato_custom_leave_types", JSON.stringify(customLeaveTypes));
  }, [customLeaveTypes]);

  // 6. Load/Save customizable form settings from localStorage
  const [customFormSettings, setCustomFormSettings] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("yato_custom_leave_form_settings");
      if (saved) return JSON.parse(saved);
    }
    return {
      requireAttachment: false,
      enableBackupEmployee: false,
      enableEmergencyContact: false,
    };
  });

  useEffect(() => {
    localStorage.setItem("yato_custom_leave_form_settings", JSON.stringify(customFormSettings));
  }, [customFormSettings]);

  // 7. Adjust Balance Mutation
  const updateBalanceMutation = useMutation({
    mutationFn: async ({ userId, allocated, used }: { userId: string; allocated: number; used: number }) => {
      const res = await api.patch(`/hrm/admin/leaves/balances/${userId}`, { allocated, used });
      return res.data;
    },
    onSuccess: () => {
      refetchAdminBalances();
      queryClient.invalidateQueries({ queryKey: ["hrm"] });
      setIsAdjustingBalance(null);
      showToast("User leave balance adjusted successfully!", "success");
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || "Failed to adjust balance", "error");
    }
  });

  // 8. Force Override Request Mutation
  const adminOverrideRequestMutation = useMutation({
    mutationFn: async ({ requestId, status, notes }: { requestId: string; status: "APPROVED" | "REJECTED"; notes?: string }) => {
      const res = await api.patch(`/hrm/admin/leaves/requests/${requestId}/status`, { status, notes });
      return res.data;
    },
    onSuccess: () => {
      refetchAdminRequests();
      refetchAdminBalances();
      queryClient.invalidateQueries({ queryKey: ["hrm"] });
      showToast("Leave request overridden successfully!", "success");
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || "Override failed", "error");
    }
  });

  // Filter Attendance Logs
  const filteredAttendance = adminAttendance.filter((record: any) => {
    const nameMatch = record.user.fullName?.toLowerCase().includes(searchQuery.toLowerCase());
    const emailMatch = record.user.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const divisionMatch = record.user.division?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    return nameMatch || emailMatch || divisionMatch;
  });

  const exportAdminAttendanceToCSV = () => {
    if (!filteredAttendance || filteredAttendance.length === 0) {
      showToast("No attendance data available to export.", "warning");
      return;
    }

    const headers = ["Employee Name", "Email", "Division", "Status", "Check-In", "Check-Out", "IP Address", "Lateness Reason / Notes"];
    const rows = filteredAttendance.map((record: any) => {
      const ts = record.timesheet;
      const inLog = ts?.logs?.find((l: any) => l.type === "CHECK_IN");
      const outLog = ts?.logs?.find((l: any) => l.type === "CHECK_OUT");
      
      const inTime = inLog ? new Date(inLog.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "--:--";
      const outTime = outLog ? new Date(outLog.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "--:--";
      const statusStr = ts ? ts.status : "ABSENT";
      const notesStr = ts?.latenessReason ? `Lateness: ${ts.latenessReason}` : ts?.notes ? ts.notes : "-";

      return [
        `"${record.user.fullName.replace(/"/g, '""')}"`,
        record.user.email,
        record.user.division?.name || "N/A",
        statusStr,
        inTime,
        outTime,
        inLog?.ipAddress || "N/A",
        `"${notesStr.replace(/"/g, '""')}"`
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((e: string[]) => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Company_Attendance_${selectedAdminDate}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Attendance data exported successfully!", "success");
  };

  const totalEmployees = adminAttendance.length;
  const presentEmployees = adminAttendance.filter((a: any) => a.timesheet?.status === "PRESENT").length;
  const lateEmployees = adminAttendance.filter((a: any) => a.timesheet?.status === "LATE").length;
  const absentEmployees = totalEmployees - presentEmployees - lateEmployees;

  // Access check fallback
  if (profile && !hasAnyAccess) {
    return (
      <div className="flex min-h-screen bg-slate-50 items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-20 h-20 bg-rose-50 rounded-full border border-rose-200 flex items-center justify-center mx-auto mb-6 text-rose-500">
            <Lock className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">Access Denied</h2>
          <p className="text-sm text-slate-500">You must hold appropriate permissions to access the Management Admin Panel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background font-sans text-[13px] text-slate-900">
      <MobileNav />
      <Sidebar />

      <main className="page-container flex-1">
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-100 pb-5">
          <div className="flex-1">
            <PageHeader 
              title="Management Admin Panel" 
              subtitle="Company-wide oversight of attendance timesheets, leave policies, custom rules, and resource allocations." 
            />
          </div>
          
          {hasAttendancePerm && hasLeavesPerm && (
            <div className="bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-sm shrink-0 flex items-center gap-1.5">
              <button
                onClick={() => setActiveTab("attendance")}
                className={cn(
                  "px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-2",
                  activeTab === "attendance"
                    ? "bg-white text-slate-800 shadow-md shadow-slate-200/50"
                    : "text-slate-400 hover:text-slate-655"
                )}
              >
                <Clock className="w-3.5 h-3.5" />
                Attendance logs
              </button>
              <button
                onClick={() => setActiveTab("leaves")}
                className={cn(
                  "px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-2",
                  activeTab === "leaves"
                    ? "bg-white text-slate-800 shadow-md shadow-slate-200/50"
                    : "text-slate-400 hover:text-slate-655"
                )}
              >
                <Coffee className="w-3.5 h-3.5" />
                Leaves oversight
              </button>
            </div>
          )}
        </header>

        {/* ========================================================================= */}
        {/* ATTENDANCE OVERSIGHT TAB */}
        {/* ========================================================================= */}
        {activeTab === "attendance" && (
          <div className="space-y-8">
            {/* Quick Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="glass-card p-6 border border-slate-100/80 shadow-sm flex items-center gap-4">
                <div className="bg-indigo-50 p-3 rounded-2xl text-indigo-600">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Employees</div>
                  <div className="text-lg font-bold text-slate-800 mt-0.5">{totalEmployees}</div>
                </div>
              </div>

              <div className="glass-card p-6 border border-slate-100/80 shadow-sm flex items-center gap-4">
                <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">On Time</div>
                  <div className="text-lg font-bold text-emerald-600 mt-0.5">{presentEmployees}</div>
                </div>
              </div>

              <div className="glass-card p-6 border border-slate-100/80 shadow-sm flex items-center gap-4">
                <div className="bg-amber-50 p-3 rounded-2xl text-amber-600">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Late Arrival</div>
                  <div className="text-lg font-bold text-amber-600 mt-0.5">{lateEmployees}</div>
                </div>
              </div>

              <div className="glass-card p-6 border border-slate-100/80 shadow-sm flex items-center gap-4">
                <div className="bg-rose-50 p-3 rounded-2xl text-rose-600">
                  <X className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Absent/No Log</div>
                  <div className="text-lg font-bold text-rose-600 mt-0.5">{absentEmployees}</div>
                </div>
              </div>
            </div>

            {/* Attendance Table Panel */}
            <div className="bg-white border border-slate-150/60 rounded-[2rem] p-8 shadow-sm space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by Employee, Email or Division..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input-field w-full pl-11 text-xs py-2 bg-slate-50 border-slate-200"
                  />
                </div>

                {/* Date Picker */}
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <button
                    onClick={exportAdminAttendanceToCSV}
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer border border-emerald-250 transition-all flex items-center gap-1.5 shadow-sm mr-2"
                  >
                    <Download className="w-3.5 h-3.5" /> Export CSV
                  </button>
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    value={selectedAdminDate}
                    onChange={(e) => setSelectedAdminDate(e.target.value)}
                    className="input-field text-xs bg-slate-50 border-slate-200 py-1.5 px-3.5 cursor-pointer rounded-xl font-extrabold text-slate-700"
                  />
                </div>
              </div>

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
                              {inLog 
                                ? new Date(inLog.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) 
                                : "--:--"
                              }
                            </td>
                            <td className="py-4 px-4 font-mono font-bold text-slate-700">
                              {outLog 
                                ? new Date(outLog.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) 
                                : "--:--"
                              }
                            </td>
                            <td className="py-4 px-4 font-mono text-[11px] text-slate-500">
                              {inLog?.ipAddress || "N/A"}
                            </td>
                            <td className="py-4 px-4 max-w-[200px] truncate text-slate-450 font-medium" title={ts?.latenessReason || ts?.notes}>
                              {ts?.latenessReason ? (
                                <span className="text-amber-600 font-bold">⚠️ {ts.latenessReason}</span>
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

        {/* ========================================================================= */}
        {/* LEAVES OVERSIGHT TAB */}
        {/* ========================================================================= */}
        {activeTab === "leaves" && (
          <div className="space-y-8">
            {/* Quick Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass-card p-6 flex items-center gap-4 border border-slate-100/80 shadow-sm">
                <div className="bg-blue-50 p-3 rounded-2xl text-blue-600">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t("Employees on Leave")}</div>
                  <div className="text-lg font-bold text-slate-800 mt-0.5">
                    {adminRequests.filter((r: any) => {
                      const today = new Date();
                      const start = new Date(r.startDate);
                      const end = new Date(r.endDate);
                      return r.status === "APPROVED" && today >= start && today <= end;
                    }).length} {t("People")}
                  </div>
                </div>
              </div>

              <div className="glass-card p-6 flex items-center gap-4 border border-slate-100/80 shadow-sm">
                <div className="bg-amber-50 p-3 rounded-2xl text-amber-600">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t("Pending Requests Oversight")}</div>
                  <div className="text-lg font-bold text-amber-600 mt-0.5">
                    {adminRequests.filter((r: any) => r.status === "PENDING").length} {t("Requests")}
                  </div>
                </div>
              </div>

              <div className="glass-card p-6 flex items-center gap-4 border border-slate-100/80 shadow-sm">
                <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t("Total Registered Active")}</div>
                  <div className="text-lg font-bold text-emerald-600 mt-0.5">
                    {adminBalances.length} {t("Employees")}
                  </div>
                </div>
              </div>
            </div>

            {/* Active Leaves (Sedang Cuti) Tracker */}
            <div className="bg-white border border-slate-150/60 rounded-[2rem] p-8 shadow-sm space-y-4">
              <div className="text-sm font-bold text-slate-850 flex items-center gap-2 border-b border-slate-100 pb-3">
                <Calendar className="w-4.5 h-4.5 text-blue-600" />
                <span>{t("Employees on Leave Today")}</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(() => {
                  const today = new Date();
                  const onLeaveUsers = adminRequests.filter((r: any) => {
                    const start = new Date(r.startDate);
                    const end = new Date(r.endDate);
                    return r.status === "APPROVED" && today >= start && today <= end;
                  });

                  if (onLeaveUsers.length === 0) {
                    return (
                      <div className="col-span-full py-8 text-center text-slate-400 font-semibold text-xs">
                        {t("No employees are on leave today.")}
                      </div>
                    );
                  }

                  return onLeaveUsers.map((req: any) => (
                    <div key={req.id} className="bg-blue-50/40 border border-blue-100 p-4 rounded-2xl space-y-2">
                      <div className="font-extrabold text-xs text-slate-800">{req.user.fullName}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        {req.user.division?.name || "No Division"} • {req.type.replace(/_/g, " ")}
                      </div>
                      <div className="text-[11px] text-slate-655 font-medium">
                        {t("Date")}: {new Date(req.startDate).toLocaleDateString()} {t("to")} {new Date(req.endDate).toLocaleDateString()}
                      </div>
                      <div className="text-[11px] italic text-slate-500 truncate mt-1">
                        "{req.reason}"
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Form Customizer Card */}
              <div className="bg-white border border-slate-150/60 rounded-[2rem] p-8 shadow-sm space-y-6">
                <div className="text-sm font-bold text-slate-850 flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Settings className="w-4.5 h-4.5 text-blue-600" />
                  <span>Leave Form Customization</span>
                </div>

                {/* Form Settings Toggles */}
                <div className="space-y-4">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block border-b pb-1">Enable Custom Fields</label>
                  
                  <label className="flex items-center gap-3 bg-slate-50 border border-slate-100 p-3 rounded-2xl cursor-pointer hover:bg-slate-100 transition-all select-none">
                    <input
                      type="checkbox"
                      checked={customFormSettings.requireAttachment}
                      onChange={(e) => setCustomFormSettings({ ...customFormSettings, requireAttachment: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-700">Require Document Attachment</div>
                      <div className="text-[10px] text-slate-400 font-medium">Requires uploading supporting certificate URL/PDF.</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 bg-slate-50 border border-slate-100 p-3 rounded-2xl cursor-pointer hover:bg-slate-100 transition-all select-none">
                    <input
                      type="checkbox"
                      checked={customFormSettings.enableBackupEmployee}
                      onChange={(e) => setCustomFormSettings({ ...customFormSettings, enableBackupEmployee: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-700">Handover Employee Field</div>
                      <div className="text-[10px] text-slate-400 font-medium">Input backup employee name during leave.</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 bg-slate-50 border border-slate-100 p-3 rounded-2xl cursor-pointer hover:bg-slate-100 transition-all select-none">
                    <input
                      type="checkbox"
                      checked={customFormSettings.enableEmergencyContact}
                      onChange={(e) => setCustomFormSettings({ ...customFormSettings, enableEmergencyContact: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-700">Emergency Contact Field</div>
                      <div className="text-[10px] text-slate-400 font-medium">Alternative phone number for emergency contact.</div>
                    </div>
                  </label>
                </div>

                {/* Custom Leave Types Options */}
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Add/Edit Leave Types</label>
                  
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Example: Maternity Leave..."
                      value={newLeaveType}
                      onChange={(e) => setNewLeaveType(e.target.value)}
                      className="input-field flex-1 bg-slate-50 text-xs py-2 border-slate-200"
                    />
                    <button
                      onClick={() => {
                        if (!newLeaveType.trim()) return;
                        if (customLeaveTypes.includes(newLeaveType.trim())) return;
                        setCustomLeaveTypes(prev => [...prev, newLeaveType.trim()]);
                        setNewLeaveType("");
                      }}
                      className="bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-500 cursor-pointer flex items-center justify-center transition-all shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
                    {customLeaveTypes.map((type, idx) => (
                      <div key={idx} className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-655 font-bold">{type}</span>
                        {customLeaveTypes.length > 1 && (
                          <button
                            onClick={() => setCustomLeaveTypes(prev => prev.filter((_, i) => i !== idx))}
                            className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Leave Balances & Requests Tables */}
              <div className="lg:col-span-2 space-y-6">
                {/* Leave Balances Grid (Sisa Cuti, Digunakan, Total) */}
                <div className="bg-white border border-slate-150/60 rounded-[2rem] p-8 shadow-sm space-y-4">
                  <div className="text-sm font-bold text-slate-850 flex items-center gap-2 border-b border-slate-100 pb-3">
                    <Users className="w-4.5 h-4.5 text-blue-600" />
                    <span>Employee Leave Balances</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-widest text-[9px] font-bold">
                          <th className="pb-3 text-left">Employee</th>
                          <th className="pb-3 text-center">Initial Balance</th>
                          <th className="pb-3 text-center">Used</th>
                          <th className="pb-3 text-center">Remaining Leave</th>
                          <th className="pb-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminBalances.map((bal: any) => (
                          <tr key={bal.userId} className="border-b border-slate-100 hover:bg-slate-50/40">
                            <td className="py-3">
                              <div className="font-extrabold text-slate-800">{bal.fullName}</div>
                              <div className="text-[10px] text-slate-400 font-medium">{bal.divisionName} • {bal.email}</div>
                            </td>
                            <td className="py-3 text-center font-bold text-slate-700">{bal.allocated} {t("Days")}</td>
                            <td className="py-3 text-center font-bold text-amber-600">{bal.used} {t("Days")}</td>
                            <td className="py-3 text-center font-black text-blue-600">{bal.remaining} {t("Days")}</td>
                            <td className="py-3 text-center">
                              <button
                                onClick={() => {
                                  setIsAdjustingBalance(bal);
                                  setAdjustForm({ allocated: bal.allocated, used: bal.used });
                                }}
                                className="bg-slate-50 hover:bg-slate-100 text-slate-655 p-2 rounded-xl inline-flex items-center gap-1.5 font-bold transition-all border border-slate-200"
                              >
                                <Edit2 className="w-3 h-3 text-blue-600" /> {t("Adjust")}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* All Requests Oversight Pipeline */}
                <div className="bg-white border border-slate-150/60 rounded-[2rem] p-8 shadow-sm space-y-4">
                  <div className="text-sm font-bold text-slate-850 flex items-center gap-2 border-b border-slate-100 pb-3">
                    <Shield className="w-4.5 h-4.5 text-blue-600" />
                    <span>{t("All Leave Requests (Admin Log)")}</span>
                  </div>

                  <div className="space-y-4 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
                    {adminRequests.map((req: any) => (
                      <div key={req.id} className="bg-slate-50/50 border border-slate-100 p-5 rounded-2xl space-y-3 hover:border-slate-200 transition-all">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <span className="font-extrabold text-slate-800 text-xs">{req.user?.fullName}</span>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{req.user?.division?.name || "No Division"}</div>
                          </div>
                          <span className={cn(
                            "text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border",
                            req.status === "APPROVED" && "bg-emerald-50 text-emerald-600 border-emerald-100",
                            req.status === "PENDING" && "bg-blue-50 text-blue-600 border-blue-100",
                            req.status === "REJECTED" && "bg-rose-50 text-rose-600 border-rose-100"
                          )}>
                            {req.status}
                          </span>
                        </div>

                        <div className="text-xs text-slate-655 font-bold">
                          {t("Type:")} {req.type.replace(/_/g, " ")} • 📅 {new Date(req.startDate).toLocaleDateString()} {t("to")} {new Date(req.endDate).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-slate-500 italic bg-white border border-slate-100 rounded-xl p-2.5">
                          {t("Reason:")} "{req.reason}"
                        </div>

                        {/* Admin Action Override controls */}
                        <div className="flex items-center justify-between gap-4 pt-3 border-t border-slate-100">
                          <div className="text-[10px] text-slate-400 font-medium">
                            {t("Created:")} {new Date(req.createdAt).toLocaleString()}
                          </div>
                          
                          <div className="flex gap-2">
                            <button
                              onClick={() => handlePrintLeaveForm(req)}
                              className="bg-slate-50 hover:bg-slate-100 text-slate-655 px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-wider cursor-pointer border border-slate-200 transition-all flex items-center gap-1.5 shadow-sm"
                              title="Export to PDF / Preview PDF"
                            >
                              <Printer className="w-3.5 h-3.5 text-blue-655" />
                              <span>{t("Export PDF")}</span>
                            </button>
                            <button
                              onClick={() => {
                                const notes = prompt("Admin notes for approval:");
                                if (notes === null) return;
                                adminOverrideRequestMutation.mutate({ requestId: req.id, status: "APPROVED", notes });
                              }}
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-wider cursor-pointer border border-emerald-200 transition-all border-dashed"
                            >
                              {t("Force Approve")}
                            </button>
                            <button
                              onClick={() => {
                                const notes = prompt("Admin notes for rejection:");
                                if (notes === null) return;
                                adminOverrideRequestMutation.mutate({ requestId: req.id, status: "REJECTED", notes });
                              }}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-700 px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-wider cursor-pointer border border-rose-200 transition-all border-dashed"
                            >
                              {t("Force Reject")}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {adminRequests.length === 0 && (
                      <div className="py-16 text-center text-slate-400 font-semibold text-xs">
                        {t("No leave request activity yet.")}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Adjust Leave Balance Modal */}
      <AnimatePresence>
        {isAdjustingBalance && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm border border-slate-100 p-8"
            >
              <h3 className="text-base font-bold text-slate-850 mb-1">Adjust Leave Balance</h3>
              <p className="text-[11px] font-medium text-slate-400 mb-6">Manually override total leave allocations for <strong>{isAdjustingBalance.fullName}</strong></p>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Total Allocated Leave (Initial Balance)</label>
                  <input
                    type="number"
                    min={0}
                    value={adjustForm.allocated}
                    onChange={(e) => setAdjustForm({ ...adjustForm, allocated: parseInt(e.target.value) || 0 })}
                    className="input-field w-full py-2.5 bg-slate-50 font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Used Leave (Used)</label>
                  <input
                    type="number"
                    min={0}
                    value={adjustForm.used}
                    onChange={(e) => setAdjustForm({ ...adjustForm, used: parseInt(e.target.value) || 0 })}
                    className="input-field w-full py-2.5 bg-slate-50 font-bold text-amber-600"
                  />
                </div>

                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 flex justify-between text-xs items-center font-bold">
                  <span className="text-slate-500 font-medium">New Remaining Leave:</span>
                  <span className="text-blue-600 text-xs font-black">{(adjustForm.allocated - adjustForm.used) || 0} Days</span>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsAdjustingBalance(null)}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={updateBalanceMutation.isPending}
                    onClick={() => {
                      updateBalanceMutation.mutate({
                        userId: isAdjustingBalance.userId,
                        allocated: adjustForm.allocated,
                        used: adjustForm.used,
                      });
                    }}
                    className="btn-primary flex-1 bg-blue-600 hover:bg-blue-550 flex items-center justify-center gap-1.5"
                  >
                    {updateBalanceMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Save Adjust</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Printable Leave Request Form */}
      {selectedPrintLeave && (
        <div id="printable-leave-form" className="hidden print:block p-12 bg-white text-black font-sans min-h-screen">
          {/* Header Branding */}
          <div className="flex items-center justify-between border-b-2 border-slate-950 pb-6 mb-8">
            <div className="flex items-center gap-4">
              {appLogo ? (
                <img src={appLogo} alt="Logo" className="w-12 h-12 object-contain" />
              ) : (
                <div className="w-12 h-12 bg-slate-900 flex items-center justify-center text-white font-bold rounded-xl text-xl">
                  Y
                </div>
              )}
              <div>
                <h1 className="text-xl font-black uppercase tracking-tight text-slate-900">{appName || "YATO"}</h1>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Enterprise HR Management Hub</p>
              </div>
            </div>
            <div className="text-right text-[10px] font-mono text-slate-400">
              <p>DOCUMENT ID: {selectedPrintLeave.id}</p>
              <p>DATE GENERATED: {new Date().toLocaleString()}</p>
            </div>
          </div>

          {/* Document Title */}
          <div className="text-center mb-8">
            <h2 className="text-lg font-black uppercase tracking-widest text-slate-900 decoration-double underline underline-offset-4">
              EMPLOYEE LEAVE APPLICATION FORM
            </h2>
            <p className="text-xs text-slate-500 mt-1">Document Status: <strong className="uppercase">{selectedPrintLeave.status}</strong></p>
          </div>

          {/* Information Section */}
          <div className="grid grid-cols-2 gap-8 mb-8 border border-slate-200 rounded-2xl p-6">
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b pb-1">EMPLOYEE PROFILE</h3>
              <table className="w-full text-xs text-left">
                <tbody>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 font-bold text-slate-500">Full Name</td>
                    <td className="py-2 text-slate-900 font-extrabold">{selectedPrintLeave.user?.fullName || "YATO Employee"}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 font-bold text-slate-500">Department / Division</td>
                    <td className="py-2 text-slate-900">{selectedPrintLeave.user?.division?.name || "Unassigned"}</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-bold text-slate-500">Email Address</td>
                    <td className="py-2 text-slate-900">{selectedPrintLeave.user?.email || "-"}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b pb-1">APPLICATION DETAILS</h3>
              <table className="w-full text-xs text-left">
                <tbody>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 font-bold text-slate-500">Leave Type</td>
                    <td className="py-2 text-slate-900 font-bold uppercase">{selectedPrintLeave.type}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 font-bold text-slate-500">Leave Duration</td>
                    <td className="py-2 text-slate-900 font-bold">
                      {new Date(selectedPrintLeave.startDate).toLocaleDateString()} to {new Date(selectedPrintLeave.endDate).toLocaleDateString()}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 font-bold text-slate-500">Reason / Detail</td>
                    <td className="py-2 text-slate-900 italic">"{selectedPrintLeave.reason}"</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Workflow Tracker */}
          <div className="space-y-4 mb-12">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 border-b pb-2">WORKFLOW APPROVAL TRACKER (HIERARCHICAL APPROVAL)</h3>
            <table className="w-full text-xs border border-slate-200 rounded-xl overflow-hidden">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-3 text-left font-black text-slate-600">LEVEL</th>
                  <th className="p-3 text-left font-black text-slate-600">POSITION ROLE</th>
                  <th className="p-3 text-left font-black text-slate-600">APPROVER</th>
                  <th className="p-3 text-left font-black text-slate-600">STATUS</th>
                  <th className="p-3 text-left font-black text-slate-600">REVIEW NOTES</th>
                </tr>
              </thead>
              <tbody>
                {selectedPrintLeave.approvals?.map((app: any) => (
                  <tr key={app.id} className="border-b border-slate-100">
                    <td className="p-3 font-mono font-bold text-slate-500">Lvl {app.level}</td>
                    <td className="p-3 font-bold text-slate-700">{app.roleName}</td>
                    <td className="p-3 text-slate-800">{app.approver?.fullName || "-"}</td>
                    <td className="p-3 font-black uppercase">{app.status}</td>
                    <td className="p-3 text-slate-500 italic">"{app.notes || '-'}"</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Signature Boxes */}
          <div className="grid grid-cols-2 gap-12 pt-8 border-t border-slate-200">
            <div className="text-center space-y-16">
              <div>
                <p className="text-xs font-bold text-slate-400">Applicant (Employee),</p>
              </div>
              <div>
                <p className="text-xs font-black text-slate-900 underline underline-offset-4">{selectedPrintLeave.user?.fullName || "YATO Employee"}</p>
                <p className="text-[10px] text-slate-400 mt-1">Signature & Date</p>
              </div>
            </div>

            <div className="text-center space-y-16">
              <div>
                <p className="text-xs font-bold text-slate-400">Final Approver (Dept Head),</p>
              </div>
              <div>
                <p className="text-xs font-black text-slate-900 underline underline-offset-4">
                  {selectedPrintLeave.approvals?.find((a: any) => a.level === 3)?.approver?.fullName || "________________________"}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">Signature & Date</p>
              </div>
            </div>
          </div>

          {/* Footnote */}
          <div className="mt-20 text-center text-[9px] text-slate-400 border-t pt-4">
            <p>This form is an official digital document generated automatically by {appName || "YATO"} Platform.</p>
            <p className="font-mono mt-0.5">Checksum: MD5-{selectedPrintLeave.id.substring(0, 8).toUpperCase()}</p>
          </div>

          {/* Global Print CSS Injector */}
          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              body * {
                visibility: hidden !important;
              }
              #printable-leave-form, #printable-leave-form * {
                visibility: visible !important;
              }
              #printable-leave-form {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                background: white !important;
                color: black !important;
                display: block !important;
              }
            }
          `}} />
        </div>
      )}
    </div>
  );
}

export default function ManagementAdminPanelPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen bg-background items-center justify-center p-6 text-slate-500">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="text-xs font-bold uppercase tracking-wider">Loading panel...</span>
        </div>
      </div>
    }>
      <ManagementAdminPanelContent />
    </Suspense>
  );
}
