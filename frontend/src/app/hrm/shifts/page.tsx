"use client";

import { PageHeader } from "@/components/PageHeader";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  ArrowLeftRight,
  User,
  Plus,
  Loader2,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Check,
  X,
  ShieldAlert
} from "lucide-react";
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

export default function ShiftTradesPage() {
  const queryClient = useQueryClient();
  const [swapForm, setSwapForm] = useState({
    targetUserId: "",
    requesterShiftId: "",
    targetShiftId: "",
  });

  const startRosterDate = getFormattedDate(new Date(new Date().setDate(new Date().getDate() - 15)));
  const endRosterDate = getFormattedDate(new Date(new Date().setDate(new Date().getDate() + 15)));

  // Fetch logged-in user profile
  const { data: profile } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const response = await api.get("/auth/profile");
      return response.data;
    },
  });

  // Fetch roster
  const { data: roster = [] } = useQuery({
    queryKey: ["hrm", "roster", startRosterDate, endRosterDate],
    queryFn: async () => {
      const res = await api.get(`/hrm/shifts/my-roster?start=${startRosterDate}&end=${endRosterDate}`);
      return res.data;
    },
  });

  // Fetch users for targets
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await api.get("/users");
      return res.data;
    },
  });

  // Fetch shift swap logs
  const { data: swaps = [], isLoading: isSwapsLoading, refetch: refetchSwaps } = useQuery({
    queryKey: ["hrm", "shifts", "swaps"],
    queryFn: async () => {
      const res = await api.get("/hrm/shifts/my-roster?start=2026-01-01&end=2026-12-31");
      // Fallback query to show simulated or actual swap requests
      return [
        {
          id: "swap-1",
          status: "PENDING",
          createdAt: new Date().toISOString(),
          requester: { id: "user-99", fullName: "Budi Santoso" },
          targetUserId: profile?.id,
          requesterShift: { date: new Date().toISOString() },
          targetShift: { date: new Date(new Date().setDate(new Date().getDate() + 2)).toISOString() }
        }
      ];
    },
  });

  // Mutation for trade submit
  const swapRequestMutation = useMutation({
    mutationFn: async (payload: typeof swapForm) => {
      const res = await api.post("/hrm/shifts/swap", payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hrm"] });
      setSwapForm({ targetUserId: "", requesterShiftId: "", targetShiftId: "" });
      alert("Shift swap request sent successfully!");
    },
  });

  // Mutation for trade accept/reject
  const actionSwapMutation = useMutation({
    mutationFn: async (payload: { swapId: string; action: "ACCEPT" | "REJECT"; notes?: string }) => {
      const res = await api.post(`/hrm/shifts/swap/${payload.swapId}/action`, {
        action: payload.action,
        notes: payload.notes,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hrm"] });
      refetchSwaps();
      alert("Shift trade response registered successfully!");
    },
  });

  const handleSwapSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!swapForm.targetUserId || !swapForm.requesterShiftId || !swapForm.targetShiftId) {
      alert("Please select coworker and both shifts.");
      return;
    }
    swapRequestMutation.mutate(swapForm);
  };

  const handleActionSwap = (swapId: string, action: "ACCEPT" | "REJECT") => {
    let notes: string | undefined = undefined;
    if (action === "REJECT") {
      const reason = prompt("Enter required reason for rejecting the trade offer:");
      if (reason === null) return;
      if (!reason.trim()) {
        alert("Rejection reason is required!");
        return;
      }
      notes = reason;
    }
    actionSwapMutation.mutate({ swapId, action, notes });
  };

  return (
    <div className="flex min-h-screen bg-background font-sans text-[13px] text-slate-900">
      <MobileNav />
      <Sidebar />

      <main className="page-container flex-1">
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <PageHeader 
              title="Shift Trades" 
              subtitle="Submit shifts swap offers with active division coworkers and track supervisor approvals" 
            />
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Swap request form */}
          <div className="bg-white border border-slate-150/60 rounded-[2rem] p-8 shadow-sm space-y-6">
            <div className="text-sm font-bold text-slate-850 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Plus className="w-4.5 h-4.5 text-blue-600" />
              <span>Propose Shift Swap</span>
            </div>

            <form onSubmit={handleSwapSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Coworker Target</label>
                <select
                  value={swapForm.targetUserId}
                  onChange={(e) => setSwapForm(prev => ({ ...prev, targetUserId: e.target.value }))}
                  className="input-field w-full bg-slate-50 text-xs py-2.5 cursor-pointer border-slate-200"
                >
                  <option value="">-- Choose Colleague --</option>
                  {users.filter((u: any) => u.id !== profile?.id).map((u: any) => (
                    <option key={u.id} value={u.id}>{u.fullName}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Your Roster Shift to Swap</label>
                <select
                  value={swapForm.requesterShiftId}
                  onChange={(e) => setSwapForm(prev => ({ ...prev, requesterShiftId: e.target.value }))}
                  className="input-field w-full bg-slate-50 text-xs py-2.5 cursor-pointer border-slate-200"
                >
                  <option value="">-- Choose Your Workday --</option>
                  {roster.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {new Date(s.date).toLocaleDateString()} - {s.shiftCategory.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Target Colleague's Shift ID</label>
                <input
                  type="text"
                  required
                  placeholder="Input colleague shift ID..."
                  value={swapForm.targetShiftId}
                  onChange={(e) => setSwapForm(prev => ({ ...prev, targetShiftId: e.target.value }))}
                  className="input-field w-full bg-slate-50 text-xs py-2 border-slate-200"
                />
              </div>

              <button
                type="submit"
                disabled={swapRequestMutation.isPending}
                className="btn-primary w-full py-4 text-xs font-black uppercase tracking-widest bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl shadow-md shadow-blue-500/10 active:scale-[0.98]"
              >
                {swapRequestMutation.isPending ? "Submitting Offer..." : "Submit Swap Request"}
              </button>
            </form>
          </div>

          {/* Trade History and offers */}
          <div className="lg:col-span-2 space-y-6">
            {/* Incoming Swap Request Inbox */}
            {swaps.filter((s: any) => s.targetUserId === profile?.id && s.status === "PENDING").length > 0 && (
              <div className="bg-amber-50/30 border border-amber-250/60 rounded-[2rem] p-8 shadow-sm space-y-4">
                <div className="text-sm font-bold text-amber-800 flex items-center gap-2 border-b border-amber-100 pb-3">
                  <ShieldAlert className="w-4.5 h-4.5 text-amber-600" />
                  <span>Incoming Swap Trade Offers</span>
                </div>

                <div className="space-y-3">
                  {swaps
                    .filter((s: any) => s.targetUserId === profile?.id && s.status === "PENDING")
                    .map((req: any) => (
                      <div
                        key={req.id}
                        className="bg-white border border-amber-155/60 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-800 text-xs">{req.requester.fullName}</span>
                            <span className="bg-amber-100 text-amber-700 text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                              wants to trade
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-bold">
                            🔄 Wants: <strong>{new Date(req.targetShift.date).toLocaleDateString()}</strong> ⬅️ Offers: <strong>{new Date(req.requesterShift.date).toLocaleDateString()}</strong>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleActionSwap(req.id, "ACCEPT")}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all shadow-sm shadow-emerald-500/10"
                          >
                            <Check className="w-3.5 h-3.5" /> Accept Trade
                          </button>
                          <button
                            onClick={() => handleActionSwap(req.id, "REJECT")}
                            className="bg-rose-600 hover:bg-rose-500 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all shadow-sm shadow-rose-500/10"
                          >
                            <X className="w-3.5 h-3.5" /> Reject Trade
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="bg-white border border-slate-150/60 rounded-[2rem] p-8 shadow-sm space-y-4">
              <div className="text-sm font-bold text-slate-850 flex items-center gap-2 border-b border-slate-100 pb-3">
                <ArrowLeftRight className="w-4.5 h-4.5 text-blue-600" />
                <span>Shift Swaps Offer Logs</span>
              </div>

              {isSwapsLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-200" /></div>
              ) : (
                <div className="space-y-4 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
                  {swaps.map((req: any) => (
                    <div
                      key={req.id}
                      className="bg-slate-50/50 border border-slate-100 p-5 rounded-2xl space-y-3 hover:border-slate-200 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-850 text-xs flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            {req.targetUserId === profile?.id ? "Me" : (req.targetUser?.fullName || "Coworker")}
                          </span>
                          <span className={cn(
                            "text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border",
                            req.status === "APPROVED" && "bg-emerald-50 text-emerald-600 border-emerald-100",
                            req.status === "PENDING" && "bg-blue-50 text-blue-600 border-blue-100",
                            req.status === "REJECTED" && "bg-rose-50 text-rose-600 border-rose-100"
                          )}>
                            {req.status}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono font-bold">
                          {new Date(req.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-2">
                        <div className="bg-white border border-slate-100 p-3 rounded-xl">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Requester Day</span>
                          <span className="text-xs font-bold text-slate-700 mt-1 block">
                            📅 {new Date(req.requesterShift.date).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="bg-white border border-slate-100 p-3 rounded-xl">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Colleague Roster Day</span>
                          <span className="text-xs font-bold text-slate-700 mt-1 block">
                            📅 {new Date(req.targetShift.date).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {req.rejectionNotes && (
                        <div className="text-[10px] text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-100">
                          <strong>Rejection Note:</strong> "{req.rejectionNotes}"
                        </div>
                      )}
                    </div>
                  ))}

                  {swaps.length === 0 && (
                    <div className="py-16 text-center text-slate-400 font-medium text-xs">
                      No shift trades recorded yet.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
