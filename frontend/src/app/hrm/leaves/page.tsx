"use client";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  Coffee,
  Shield,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Check,
  X,
  Plus,
  Loader2,
  Printer,
  Users,
  Settings,
  Edit2,
  AlertTriangle,
  Calendar,
  Lock
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useBranding } from "@/context/branding-context";
import { useRouter } from "next/navigation";
import { useIsAdmin } from "@/hooks/useIsAdmin";



export default function LeaveHubPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const { appName, appLogo } = useBranding();
  const [selectedPrintLeave, setSelectedPrintLeave] = useState(null as any | null);
  
  // Navigation Tabs: "my" (personal leave hub) vs "admin" (admin panel control)
  const [activeTab, setActiveTab] = useState("my" as "my" | "admin");

  // Admin Modals & Controls state
  const [isAdjustingBalance, setIsAdjustingBalance] = useState(null as any | null);
  const [adjustForm, setAdjustForm] = useState({ allocated: 12, used: 0 });
  const [newLeaveType, setNewLeaveType] = useState("");

  const handlePrintLeaveForm = (leave: any) => {
    setSelectedPrintLeave(leave);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  const { isAdmin, profile, permissions: userPermissions, isLoading: isAuthLoading } = useIsAdmin(["HR"]);
  const canView = isAdmin || userPermissions.includes("VIEW_HRM") || userPermissions.includes("MANAGE_HRM");
  const canAccessAdmin = isAdmin || userPermissions.includes("VIEW_HRM_ADMIN_PANEL") || userPermissions.includes("MANAGE_HRM") || userPermissions.includes("MANAGE_HRM_LEAVES");

  // 2. Load and save customizable leave types (saved in localStorage for tenant flexibility)
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

  // 3. Load and save customizable leave form settings (Required field toggles)
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

  // Personal Form state
  const [leaveForm, setLeaveForm] = useState({
    type: "Annual Leave (Cuti Tahunan)",
    startDate: "",
    endDate: "",
    reason: "",
    backupEmployee: "",
    emergencyContact: "",
    attachmentUrl: "",
  } as any);

  // Fetch Leave Balance
  const { data: leaveBalance } = useQuery({
    queryKey: ["hrm", "leave-balance", currentYear],
    queryFn: async () => {
      const res = await api.get(`/hrm/leaves/balance?year=${currentYear}`);
      return res.data;
    },
  });

  // Fetch Leaves History
  const { data: leaves = [], isLoading: isLeavesLoading, refetch: refetchLeaves } = useQuery({
    queryKey: ["hrm", "leaves"],
    queryFn: async () => {
      const res = await api.get("/hrm/leaves/my");
      return res.data;
    },
  });

  // Fetch Pending Approvals to Act on
  const { data: pendingApprovals = [], refetch: refetchPendingApprovals } = useQuery({
    queryKey: ["hrm", "pending-approvals"],
    queryFn: async () => {
      const res = await api.get("/hrm/leaves/pending");
      return res.data;
    },
  });

  // ADMIN SPECIFIC QUERIES
  // Fetch all user leave balances
  const { data: adminBalances = [], refetch: refetchAdminBalances } = useQuery({
    queryKey: ["hrm", "admin-balances"],
    queryFn: async () => {
      const res = await api.get("/hrm/admin/leaves/balances");
      return res.data;
    },
    enabled: isAdmin,
  });

  // Fetch all leave requests for oversight
  const { data: adminRequests = [], refetch: refetchAdminRequests } = useQuery({
    queryKey: ["hrm", "admin-requests"],
    queryFn: async () => {
      const res = await api.get("/hrm/admin/leaves/requests");
      return res.data;
    },
    enabled: isAdmin,
  });

  // Submit leave request mutation
  const leaveRequestMutation = useMutation({
    mutationFn: async (payload: any) => {
      // If customized fields exist, merge them into the reason/notes to preserve data
      const extendedReason = [
        payload.reason,
        payload.backupEmployee ? `[Backup Employee: ${payload.backupEmployee}]` : "",
        payload.emergencyContact ? `[Emergency Contact: ${payload.emergencyContact}]` : "",
        payload.attachmentUrl ? `[Attachment: ${payload.attachmentUrl}]` : "",
      ].filter(Boolean).join(" ");

      const res = await api.post("/hrm/leaves", {
        type: payload.type.toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, ""),
        startDate: payload.startDate,
        endDate: payload.endDate,
        reason: extendedReason,
      });
      return res.data;
    },
    onSuccess: () => {
      refetchLeaves();
      queryClient.invalidateQueries({ queryKey: ["hrm"] });
      setLeaveForm({
        type: customLeaveTypes[0] || "Annual Leave (Cuti Tahunan)",
        startDate: "",
        endDate: "",
        reason: "",
        backupEmployee: "",
        emergencyContact: "",
        attachmentUrl: "",
      });
      alert("Leave request submitted successfully!");
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || "Failed to submit leave request.");
    }
  });

  // Take leave action mutation
  const leaveApprovalMutation = useMutation({
    mutationFn: async (payload: { approvalId: string; action: "APPROVED" | "REJECTED"; notes?: string }) => {
      const res = await api.post(`/hrm/leaves/action/${payload.approvalId}`, {
        action: payload.action,
        notes: payload.notes,
      });
      return res.data;
    },
    onSuccess: () => {
      refetchPendingApprovals();
      refetchAdminRequests();
      queryClient.invalidateQueries({ queryKey: ["hrm"] });
    },
  });

  // Admin mutation to adjust leave balance
  const updateBalanceMutation = useMutation({
    mutationFn: async ({ userId, allocated, used }: { userId: string; allocated: number; used: number }) => {
      const res = await api.patch(`/hrm/admin/leaves/balances/${userId}`, { allocated, used });
      return res.data;
    },
    onSuccess: () => {
      refetchAdminBalances();
      queryClient.invalidateQueries({ queryKey: ["hrm"] });
      setIsAdjustingBalance(null);
      alert("User leave balance adjusted successfully!");
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || "Failed to adjust balance");
    }
  });

  // Admin force override status mutation
  const adminOverrideRequestMutation = useMutation({
    mutationFn: async ({ requestId, status, notes }: { requestId: string; status: "APPROVED" | "REJECTED"; notes?: string }) => {
      const res = await api.patch(`/hrm/admin/leaves/requests/${requestId}/status`, { status, notes });
      return res.data;
    },
    onSuccess: () => {
      refetchAdminRequests();
      refetchAdminBalances();
      queryClient.invalidateQueries({ queryKey: ["hrm"] });
      alert("Leave request overridden successfully!");
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || "Override failed");
    }
  });

  const handleLeaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveForm.startDate || !leaveForm.endDate || !leaveForm.reason.trim()) return;
    leaveRequestMutation.mutate(leaveForm);
  };

  const handleApproveLeave = (approvalId: string) => {
    leaveApprovalMutation.mutate({ approvalId, action: "APPROVED" });
  };

  const handleRejectLeave = (approvalId: string) => {
    const notes = prompt("Enter required reason for rejection:");
    if (notes === null) return;
    if (!notes.trim()) {
      alert("Rejection notes are required!");
      return;
    }
    leaveApprovalMutation.mutate({ approvalId, action: "REJECTED", notes });
  };

  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen bg-slate-50 items-center justify-center p-6">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto" />
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading Access Policies...</p>
        </div>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="flex min-h-screen bg-slate-50 items-center justify-center p-6">
        <div className="text-center space-y-5 max-w-sm">
          <div className="w-20 h-20 bg-rose-500/10 rounded-full border border-rose-500/30 flex items-center justify-center mx-auto mb-6 text-rose-500">
            <Lock className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">Access Denied</h2>
          <p className="text-sm text-slate-500">You do not have permission to access the Leave Hub.</p>
          <div className="pt-2">
            <Link 
              href="/dashboard" 
              className="inline-flex items-center justify-center px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background font-sans text-[13px] text-slate-900">
      <MobileNav />
      <Sidebar />

      <main className="page-container flex-1">
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <PageHeader 
              title="Leave Hub" 
              subtitle="Submit annual or sick leaves, view balance metrics, and manage division hierarchy approvals" 
            />
          </div>
          {canAccessAdmin && (
            <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-sm shrink-0">
              <button
                onClick={() => setActiveTab("my")}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer",
                  activeTab === "my"
                    ? "bg-white text-slate-800 shadow-md shadow-slate-200/50"
                    : "text-slate-400 hover:text-slate-655"
                )}
              >
                My Leave
              </button>
              <button
                onClick={() => router.push("/hrm/admin-panel?tab=leaves")}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-2",
                  activeTab === "admin"
                    ? "bg-white text-slate-800 shadow-md shadow-slate-200/50"
                    : "text-slate-400 hover:text-slate-655"
                )}
              >
                <Shield className="w-3.5 h-3.5 text-blue-600" />
                Admin Panel
              </button>
            </div>
          )}
        </header>

        {activeTab === "my" ? (
          <>
            {/* Leave Balance Stats Header */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="glass-card p-6 flex items-center gap-4 border border-slate-100/80 shadow-sm">
                <div className="bg-blue-50 p-3 rounded-2xl">
                  <Coffee className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Allocated Leave</div>
                  <div className="text-sm font-bold text-slate-850 mt-0.5">
                    {leaveBalance ? `${leaveBalance.allocated} Days` : "12 Days"}
                  </div>
                </div>
              </div>

              <div className="glass-card p-6 flex items-center gap-4 border border-slate-100/80 shadow-sm">
                <div className="bg-emerald-50 p-3 rounded-2xl">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Used Balance</div>
                  <div className="text-sm font-bold text-slate-850 mt-0.5">
                    {leaveBalance ? `${leaveBalance.used} Days` : "0 Days"}
                  </div>
                </div>
              </div>

              <div className="glass-card p-6 flex items-center gap-4 border border-slate-100/80 shadow-sm">
                <div className="bg-indigo-50 p-3 rounded-2xl">
                  <Clock className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Remaining Leave</div>
                  <div className="text-sm font-bold text-slate-850 mt-0.5">
                    {leaveBalance ? `${leaveBalance.remaining} Days` : "12 Days"}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Submission Form Card */}
              <div className="bg-white border border-slate-150/60 rounded-[2rem] p-8 shadow-sm space-y-6">
                <div className="text-sm font-bold text-slate-850 flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Plus className="w-4.5 h-4.5 text-blue-600" />
                  <span>Apply for New Leave</span>
                </div>

                <form onSubmit={handleLeaveSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Leave Type</label>
                    <select
                      value={leaveForm.type}
                      onChange={(e) => setLeaveForm((prev: any) => ({ ...prev, type: e.target.value }))}
                      className="input-field w-full bg-slate-50 text-xs py-2.5 cursor-pointer border-slate-200"
                    >
                      {customLeaveTypes.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Start Date</label>
                      <input
                        type="date"
                        required
                        value={leaveForm.startDate}
                        onChange={(e) => setLeaveForm((prev: any) => ({ ...prev, startDate: e.target.value }))}
                        className="input-field w-full bg-slate-50 text-xs py-2 border-slate-200"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">End Date</label>
                      <input
                        type="date"
                        required
                        value={leaveForm.endDate}
                        onChange={(e) => setLeaveForm((prev: any) => ({ ...prev, endDate: e.target.value }))}
                        className="input-field w-full bg-slate-50 text-xs py-2 border-slate-200"
                      />
                    </div>
                  </div>

                  {(() => {
                    if (!leaveForm.startDate || !leaveForm.endDate) return null;
                    const start = new Date(leaveForm.startDate);
                    const end = new Date(leaveForm.endDate);
                    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
                    const diffTime = end.getTime() - start.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                    return (
                      <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3.5 flex items-center justify-between text-xs select-none">
                        <span className="font-bold text-slate-500">Total Leave Duration:</span>
                        <span className={cn(
                          "px-3 py-1 rounded-lg font-black text-[10px] uppercase tracking-wider border",
                          diffDays <= 0 
                            ? "bg-rose-50 text-rose-600 border-rose-100" 
                            : "bg-blue-100 text-blue-800 border-blue-200"
                        )}>
                          {diffDays <= 0 ? "Invalid Date" : `${diffDays} Days`}
                        </span>
                      </div>
                    );
                  })()}

                  {customFormSettings.requireAttachment && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Supporting Document / Attachment URL (Required)</label>
                      <input
                        type="url"
                        required
                        placeholder="https://example.com/medical-certificate.pdf"
                        value={leaveForm.attachmentUrl}
                        onChange={(e) => setLeaveForm((prev: any) => ({ ...prev, attachmentUrl: e.target.value }))}
                        className="input-field w-full bg-slate-50 text-xs py-2 border-slate-200"
                      />
                    </div>
                  )}

                  {customFormSettings.enableBackupEmployee && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Backup / Handover Person</label>
                      <input
                        type="text"
                        placeholder="Backup Employee Name..."
                        value={leaveForm.backupEmployee}
                        onChange={(e) => setLeaveForm((prev: any) => ({ ...prev, backupEmployee: e.target.value }))}
                        className="input-field w-full bg-slate-50 text-xs py-2 border-slate-200"
                      />
                    </div>
                  )}

                  {customFormSettings.enableEmergencyContact && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Emergency Contact Phone</label>
                      <input
                        type="text"
                        placeholder="Example: 08123456789"
                        value={leaveForm.emergencyContact}
                        onChange={(e) => setLeaveForm((prev: any) => ({ ...prev, emergencyContact: e.target.value }))}
                        className="input-field w-full bg-slate-50 text-xs py-2 border-slate-200"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Reason / Details</label>
                    <textarea
                      required
                      placeholder="State your reasons clearly..."
                      value={leaveForm.reason}
                      onChange={(e) => setLeaveForm((prev: any) => ({ ...prev, reason: e.target.value }))}
                      className="input-field w-full bg-slate-50 text-xs min-h-[90px] resize-none border-slate-200"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={leaveRequestMutation.isPending}
                    className="btn-primary w-full py-4 text-xs font-black uppercase tracking-widest bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl shadow-md shadow-blue-500/10 active:scale-[0.98]"
                  >
                    {leaveRequestMutation.isPending ? "Submitting..." : "Submit Leave Request"}
                  </button>
                </form>
              </div>

              {/* Leave History & Approvals List */}
              <div className="lg:col-span-2 space-y-6">
                {/* Pending Approvals Inbox (Visible to SPV/Managers) */}
                {pendingApprovals.length > 0 && (
                  <div className="bg-amber-50/30 border border-amber-200 rounded-[2rem] p-8 shadow-sm space-y-4">
                    <div className="text-sm font-bold text-amber-800 flex items-center gap-2 border-b border-amber-100 pb-3">
                      <Shield className="w-4.5 h-4.5 text-amber-600" />
                      <span>Approval Worklist Inbox ({pendingApprovals.length})</span>
                    </div>

                    <div className="space-y-3">
                      {pendingApprovals.map((req: any) => {
                        const activeStep = req.approvals.find((a: any) => a.status === "PENDING");
                        return (
                          <div
                            key={req.id}
                            className="bg-white border border-amber-100 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-slate-800 text-xs">{req.user.fullName}</span>
                                <span className="bg-amber-100 text-amber-700 text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                  {req.type}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400 font-bold">
                                📅 {new Date(req.startDate).toLocaleDateString()} to {new Date(req.endDate).toLocaleDateString()}
                              </div>
                              <div className="text-xs text-slate-600 font-semibold italic mt-1">"{req.reason}"</div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleApproveLeave(activeStep.id)}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all shadow-sm shadow-emerald-500/10"
                              >
                                <Check className="w-3.5 h-3.5" /> Approve
                              </button>
                              <button
                                onClick={() => handleRejectLeave(activeStep.id)}
                                className="bg-rose-600 hover:bg-rose-500 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all shadow-sm shadow-rose-500/10"
                              >
                                <X className="w-3.5 h-3.5" /> Reject
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* History Card */}
                <div className="bg-white border border-slate-150/60 rounded-[2rem] p-8 shadow-sm space-y-4">
                  <div className="text-sm font-bold text-slate-850 flex items-center gap-2 border-b border-slate-100 pb-3">
                    <FileText className="w-4.5 h-4.5 text-blue-600" />
                    <span>Leave Request Pipeline Tracking</span>
                  </div>

                  <div className="space-y-4 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
                    {leaves.map((req: any) => (
                      <div
                        key={req.id}
                        className="bg-slate-50/50 border border-slate-100 p-5 rounded-2xl space-y-3 hover:border-slate-200 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 text-xs">{req.type}</span>
                            <span className={cn(
                              "text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border",
                              req.status === "APPROVED" && "bg-emerald-50 text-emerald-600 border-emerald-100",
                              req.status === "PENDING" && "bg-blue-50 text-blue-600 border-blue-100",
                              req.status === "REJECTED" && "bg-rose-50 text-rose-600 border-rose-100"
                            )}>
                              {req.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handlePrintLeaveForm(req)}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-1.5 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                              title="Print Official Form"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-[10px] text-slate-400 font-mono font-bold">
                              {new Date(req.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <div className="text-xs text-slate-600 font-medium">
                          📅 Duration: <strong className="text-slate-800">{new Date(req.startDate).toLocaleDateString()}</strong> to <strong className="text-slate-800">{new Date(req.endDate).toLocaleDateString()}</strong>
                        </div>
                        <div className="text-xs text-slate-500 italic bg-white border border-slate-100 rounded-xl p-2.5">
                          Reason: "{req.reason}"
                        </div>

                        {/* Timeline Tracker */}
                        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-100 text-[10px]">
                          {req.approvals.map((app: any) => (
                            <div key={app.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm space-y-1 relative">
                              <div className="font-black text-slate-400 uppercase tracking-widest text-[8px]">{app.roleName}</div>
                              <div className={cn(
                                "font-bold flex items-center gap-1 text-[10px] mt-1",
                                app.status === "APPROVED" && "text-emerald-600",
                                app.status === "PENDING" && "text-blue-600",
                                app.status === "REJECTED" && "text-rose-600"
                              )}>
                                {app.status === "APPROVED" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                                {app.status === "REJECTED" && <XCircle className="w-3.5 h-3.5 text-rose-500" />}
                                {app.status === "PENDING" && <Clock className="w-3.5 h-3.5 text-blue-500" />}
                                <span>{app.status}</span>
                              </div>
                              {app.notes && (
                                <p className="text-[9px] text-slate-400 mt-1 italic leading-tight">
                                  Note: "{app.notes}"
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {leaves.length === 0 && (
                      <div className="py-16 text-center text-slate-400 font-medium text-xs">
                        No leaves requested yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* ========================================================================= */
          /* ADMIN CONTROL PANEL VIEW */
          /* ========================================================================= */
          <div className="space-y-8">
            {/* Admin Metrics Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass-card p-6 flex items-center gap-4 border border-slate-100/80 shadow-sm">
                <div className="bg-blue-50 p-3 rounded-2xl">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Employees on Leave</div>
                  <div className="text-sm font-bold text-slate-850 mt-0.5">
                    {adminRequests.filter((r: any) => {
                      const today = new Date();
                      const start = new Date(r.startDate);
                      const end = new Date(r.endDate);
                      return r.status === "APPROVED" && today >= start && today <= end;
                    }).length} People
                  </div>
                </div>
              </div>

              <div className="glass-card p-6 flex items-center gap-4 border border-slate-100/80 shadow-sm">
                <div className="bg-amber-50 p-3 rounded-2xl">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pending Requests Oversight</div>
                  <div className="text-sm font-bold text-slate-850 mt-0.5">
                    {adminRequests.filter((r: any) => r.status === "PENDING").length} Requests
                  </div>
                </div>
              </div>

              <div className="glass-card p-6 flex items-center gap-4 border border-slate-100/80 shadow-sm">
                <div className="bg-emerald-50 p-3 rounded-2xl">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Registered Active</div>
                  <div className="text-sm font-bold text-slate-850 mt-0.5">
                    {adminBalances.length} Employees
                  </div>
                </div>
              </div>
            </div>

            {/* Active Leaves (Sedang Cuti) Tracker */}
            <div className="bg-white border border-slate-150/60 rounded-[2rem] p-8 shadow-sm space-y-4">
              <div className="text-sm font-bold text-slate-850 flex items-center gap-2 border-b border-slate-100 pb-3">
                <Calendar className="w-4.5 h-4.5 text-blue-600" />
                <span>Employees on Leave Today</span>
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
                        No employees are on leave today.
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
                        Date: {new Date(req.startDate).toLocaleDateString()} to {new Date(req.endDate).toLocaleDateString()}
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
                            <td className="py-3 text-center font-bold text-slate-700">{bal.allocated} Days</td>
                            <td className="py-3 text-center font-bold text-amber-600">{bal.used} Days</td>
                            <td className="py-3 text-center font-black text-blue-600">{bal.remaining} Days</td>
                            <td className="py-3 text-center">
                              <button
                                onClick={() => {
                                  setIsAdjustingBalance(bal);
                                  setAdjustForm({ allocated: bal.allocated, used: bal.used });
                                }}
                                className="bg-slate-50 hover:bg-slate-100 text-slate-655 p-2 rounded-xl inline-flex items-center gap-1.5 font-bold transition-all border border-slate-200"
                              >
                                <Edit2 className="w-3 h-3 text-blue-600" /> Adjust
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
                    <span>All Leave Requests (Admin Log)</span>
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
                          Type: {req.type.replace(/_/g, " ")} • 📅 {new Date(req.startDate).toLocaleDateString()} to {new Date(req.endDate).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-slate-500 italic bg-white border border-slate-100 rounded-xl p-2.5">
                          Reason: "{req.reason}"
                        </div>

                        {/* Admin Action Override controls */}
                        <div className="flex items-center justify-between gap-4 pt-3 border-t border-slate-100">
                          <div className="text-[10px] text-slate-400 font-medium">
                            Created: {new Date(req.createdAt).toLocaleString()}
                          </div>
                          
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                const notes = prompt("Admin notes for approval:");
                                if (notes === null) return;
                                adminOverrideRequestMutation.mutate({ requestId: req.id, status: "APPROVED", notes });
                              }}
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-wider cursor-pointer border border-emerald-200 transition-all"
                            >
                              Force Approve
                            </button>
                            <button
                              onClick={() => {
                                const notes = prompt("Admin notes for rejection:");
                                if (notes === null) return;
                                adminOverrideRequestMutation.mutate({ requestId: req.id, status: "REJECTED", notes });
                              }}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-700 px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-wider cursor-pointer border border-rose-200 transition-all"
                            >
                              Force Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {adminRequests.length === 0 && (
                      <div className="py-16 text-center text-slate-400 font-semibold text-xs">
                        No leave request activity yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Adjust Leave Balance Modal */}
            <AnimatePresence>
              {isAdjustingBalance && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsAdjustingBalance(null)}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                  />

                  <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    className="relative w-full max-w-md bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden z-10 space-y-6"
                  >
                    <div className="absolute top-0 right-0 w-48 h-48 bg-blue-50/40 rounded-full filter blur-3xl" />
                    
                    <button
                      onClick={() => setIsAdjustingBalance(null)}
                      className="absolute top-6 right-6 text-slate-400 hover:text-slate-655 bg-slate-50 hover:bg-slate-100 p-2 rounded-xl transition-all cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    <div className="space-y-2 relative z-10 text-center">
                      <span className="bg-blue-50 border border-blue-100 text-blue-600 text-[10px] font-extrabold uppercase tracking-widest px-3.5 py-1 rounded-full inline-block">
                        Adjust Leave Balance
                      </span>
                      <h3 className="text-lg font-black text-slate-800 tracking-tight">
                        {isAdjustingBalance.fullName}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                        {isAdjustingBalance.divisionName}
                      </p>
                    </div>

                    <div className="space-y-4 relative z-10">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Total Initial Leave Quota (Allocated)</label>
                        <input
                          type="number"
                          min="0"
                          value={adjustForm.allocated}
                          onChange={(e) => setAdjustForm(prev => ({ ...prev, allocated: parseInt(e.target.value, 10) || 0 }))}
                          className="input-field w-full bg-slate-50 text-xs py-2.5 border-slate-200"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Used Leave (Used)</label>
                        <input
                          type="number"
                          min="0"
                          value={adjustForm.used}
                          onChange={(e) => setAdjustForm(prev => ({ ...prev, used: parseInt(e.target.value, 10) || 0 }))}
                          className="input-field w-full bg-slate-50 text-xs py-2.5 border-slate-200"
                        />
                      </div>

                      <div className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between border border-slate-100 text-xs font-bold text-slate-700">
                        <span>New Remaining Leave Quota:</span>
                        <span className="text-blue-600 font-extrabold text-sm">{adjustForm.allocated - adjustForm.used} Days</span>
                      </div>

                      <button
                        onClick={() => {
                          updateBalanceMutation.mutate({
                            userId: isAdjustingBalance.userId,
                            allocated: adjustForm.allocated,
                            used: adjustForm.used,
                          });
                        }}
                        disabled={updateBalanceMutation.isPending}
                        className="btn-primary w-full py-4 text-xs font-black uppercase tracking-widest bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl shadow-md active:scale-[0.98]"
                      >
                        {updateBalanceMutation.isPending ? "Saving..." : "Save Balance Settings"}
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>
        )}
      </main>

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
              }
            }
          `}} />
        </div>
      )}
    </div>
  );
}

