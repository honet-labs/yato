"use client";

import { PageHeader } from "@/components/PageHeader";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  Calendar,
  Clock,
  Plus,
  Briefcase,
  Users,
  AlertCircle,
  Loader2,
  X,
  PlusCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function ShiftSchedulerPage() {
  const queryClient = useQueryClient();
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editShiftCategoryId, setEditShiftCategoryId] = useState(null as string | null);

  // Form states
  const [shiftForm, setShiftForm] = useState({
    name: "",
    startTime: "09:00",
    endTime: "18:00",
    breakStart: "12:00",
    breakEnd: "13:00",
    colorCode: "#3b82f6",
    description: "",
  });

  const [assignForm, setAssignForm] = useState({
    userId: "",
    shiftCategoryId: "",
    date: "",
    notes: "",
  });

  // Fetch shift categories
  const { data: categories = [], isLoading: isCatsLoading } = useQuery({
    queryKey: ["hrm", "shifts", "categories"],
    queryFn: async () => {
      const res = await api.get("/hrm/shifts/categories");
      return res.data;
    },
  });

  // Fetch users for assignment
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await api.get("/users");
      return res.data;
    },
  });

  // Create shift category mutation
  const createCategoryMutation = useMutation({
    mutationFn: async (payload: typeof shiftForm) => {
      const res = await api.post("/hrm/shifts/categories", {
        name: payload.name,
        startTime: payload.startTime,
        endTime: payload.endTime,
        breakStart: payload.breakStart,
        breakEnd: payload.breakEnd,
        colorCode: payload.colorCode,
        description: payload.description,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hrm"] });
      setShowShiftModal(false);
      setShiftForm({
        name: "",
        startTime: "09:00",
        endTime: "18:00",
        breakStart: "12:00",
        breakEnd: "13:00",
        colorCode: "#3b82f6",
        description: "",
      });
      alert("Shift category created successfully!");
    },
  });

  // Update shift category mutation
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: typeof shiftForm }) => {
      const res = await api.patch(`/hrm/shifts/categories/${id}`, {
        name: payload.name,
        startTime: payload.startTime,
        endTime: payload.endTime,
        breakStart: payload.breakStart,
        breakEnd: payload.breakEnd,
        colorCode: payload.colorCode,
        description: payload.description,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hrm"] });
      setShowShiftModal(false);
      setEditShiftCategoryId(null);
      setShiftForm({
        name: "",
        startTime: "09:00",
        endTime: "18:00",
        breakStart: "12:00",
        breakEnd: "13:00",
        colorCode: "#3b82f6",
        description: "",
      });
      alert("Shift category updated successfully!");
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || "Failed to update shift category";
      alert(msg);
    }
  });

  // Delete shift category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/hrm/shifts/categories/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hrm"] });
      alert("Shift category deleted successfully!");
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || "Failed to delete shift category";
      alert(msg);
    }
  });

  // Assign shift mutation
  const assignShiftMutation = useMutation({
    mutationFn: async (payload: typeof assignForm) => {
      const res = await api.post("/hrm/shifts/assign", payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hrm"] });
      setShowAssignModal(false);
      setAssignForm({ userId: "", shiftCategoryId: "", date: "", notes: "" });
      alert("Shift roster assigned successfully!");
    },
  });

  const handleEditClick = (cat: any) => {
    setEditShiftCategoryId(cat.id);
    setShiftForm({
      name: cat.name,
      startTime: cat.startTime,
      endTime: cat.endTime,
      breakStart: cat.breakStart,
      breakEnd: cat.breakEnd,
      colorCode: cat.colorCode || "#3b82f6",
      description: cat.description || "",
    });
    setShowShiftModal(true);
  };

  const handleDeleteClick = (id: string) => {
    if (confirm("Are you sure you want to delete this shift category? This will also unassign this shift from any scheduled employees.")) {
      deleteCategoryMutation.mutate(id);
    }
  };

  const handleCreateShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftForm.name.trim()) return;
    if (editShiftCategoryId) {
      updateCategoryMutation.mutate({ id: editShiftCategoryId, payload: shiftForm });
    } else {
      createCategoryMutation.mutate(shiftForm);
    }
  };

  const handleAssignShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignForm.userId || !assignForm.shiftCategoryId || !assignForm.date) return;
    assignShiftMutation.mutate(assignForm);
  };

  return (
    <div className="flex min-h-screen bg-background font-sans text-[13px] text-slate-900">
      <MobileNav />
      <Sidebar />

      <main className="page-container flex-1">
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <PageHeader 
              title="Shift Scheduler" 
              subtitle="Configure customized shift calendars, break guidelines, shift allowance tiers, and assign employee rosters" 
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setEditShiftCategoryId(null);
                setShiftForm({
                  name: "",
                  startTime: "09:00",
                  endTime: "18:00",
                  breakStart: "12:00",
                  breakEnd: "13:00",
                  colorCode: "#3b82f6",
                  description: "",
                });
                setShowShiftModal(true);
              }}
              className="btn-secondary flex items-center gap-2 py-3 px-5 text-xs font-bold uppercase bg-white border border-slate-200 text-slate-700 rounded-2xl shadow-sm hover:bg-slate-50 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-blue-600" /> New Shift Code
            </button>
            <button
              onClick={() => setShowAssignModal(true)}
              className="btn-primary flex items-center gap-2 py-3 px-5 text-xs font-bold uppercase bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl shadow-md hover:from-blue-750 cursor-pointer"
            >
              <Calendar className="w-4 h-4" /> Assign Roster
            </button>
          </div>
        </header>

        {isCatsLoading ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-400">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-3" />
            <p className="font-bold uppercase tracking-widest text-[10px]">Loading Scheduler...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {categories.map((cat: any) => (
              <div
                key={cat.id}
                className="bg-white border border-slate-150/60 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all relative overflow-hidden group"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.colorCode || '#3b82f6' }} />
                      <span className="font-extrabold text-slate-850 text-sm tracking-tight">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEditClick(cat)}
                        className="p-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                        title="Edit Shift"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteClick(cat.id)}
                        className="p-1.5 bg-slate-50 hover:bg-red-50 rounded-lg text-slate-500 hover:text-red-650 transition-colors cursor-pointer"
                        title="Delete Shift"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed italic">
                    {cat.description || "No shift category description added yet."}
                  </p>

                  <div className="grid grid-cols-2 gap-3 pt-3">
                    <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 space-y-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Working Hours</span>
                      <span className="text-xs font-mono font-bold text-blue-600 block">
                        {cat.startTime} - {cat.endTime}
                      </span>
                    </div>

                    <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 space-y-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Lunch Break</span>
                      <span className="text-xs font-mono font-bold text-amber-600 block">
                        {cat.breakStart} - {cat.breakEnd}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Shift Modal */}
        <AnimatePresence>
          {showShiftModal && (
            <div className="fixed inset-0 bg-slate-900/40 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-[2rem] border border-slate-100 shadow-2xl p-8 max-w-md w-full relative space-y-6"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-600" />
                    <h3 className="font-extrabold text-slate-800 text-sm tracking-tight">
                      {editShiftCategoryId ? "Edit Shift Code" : "Create Shift Code"}
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowShiftModal(false)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-800 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleCreateShift} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Shift Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Regular Morning Shift"
                      value={shiftForm.name}
                      onChange={(e) => setShiftForm(prev => ({ ...prev, name: e.target.value }))}
                      className="input-field w-full text-xs py-2.5 bg-slate-50 border-slate-200"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Start Time</label>
                      <input
                        type="text"
                        required
                        placeholder="09:00"
                        value={shiftForm.startTime}
                        onChange={(e) => setShiftForm(prev => ({ ...prev, startTime: e.target.value }))}
                        className="input-field w-full text-xs py-2 bg-slate-50 border-slate-200 font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">End Time</label>
                      <input
                        type="text"
                        required
                        placeholder="18:00"
                        value={shiftForm.endTime}
                        onChange={(e) => setShiftForm(prev => ({ ...prev, endTime: e.target.value }))}
                        className="input-field w-full text-xs py-2 bg-slate-50 border-slate-200 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Lunch Break Start</label>
                      <input
                        type="text"
                        required
                        placeholder="12:00"
                        value={shiftForm.breakStart}
                        onChange={(e) => setShiftForm(prev => ({ ...prev, breakStart: e.target.value }))}
                        className="input-field w-full text-xs py-2 bg-slate-50 border-slate-200 font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Lunch Break End</label>
                      <input
                        type="text"
                        required
                        placeholder="13:00"
                        value={shiftForm.breakEnd}
                        onChange={(e) => setShiftForm(prev => ({ ...prev, breakEnd: e.target.value }))}
                        className="input-field w-full text-xs py-2 bg-slate-50 border-slate-200 font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Roster Color Code</label>
                    <input
                      type="color"
                      value={shiftForm.colorCode}
                      onChange={(e) => setShiftForm(prev => ({ ...prev, colorCode: e.target.value }))}
                      className="w-full h-[40px] p-1 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Description</label>
                    <textarea
                      placeholder="e.g. Standard 8-hour workday..."
                      value={shiftForm.description}
                      onChange={(e) => setShiftForm(prev => ({ ...prev, description: e.target.value }))}
                      className="input-field w-full text-xs min-h-[60px] resize-none bg-slate-50 border-slate-200"
                    />
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowShiftModal(false)}
                      className="bg-slate-100 hover:bg-slate-250 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-blue-500/10 active:scale-[0.98] transition-all cursor-pointer"
                    >
                      {createCategoryMutation.isPending || updateCategoryMutation.isPending
                        ? "Saving..."
                        : editShiftCategoryId
                        ? "Update Shift Code"
                        : "Save Shift Code"}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Assign Shift Modal */}
        <AnimatePresence>
          {showAssignModal && (
            <div className="fixed inset-0 bg-slate-900/40 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-[2rem] border border-slate-100 shadow-2xl p-8 max-w-md w-full relative space-y-6"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <h3 className="font-extrabold text-slate-800 text-sm tracking-tight">Assign Roster Shift</h3>
                  </div>
                  <button
                    onClick={() => setShowAssignModal(false)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-800 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleAssignShift} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Choose Employee</label>
                    <select
                      value={assignForm.userId}
                      onChange={(e) => setAssignForm(prev => ({ ...prev, userId: e.target.value }))}
                      className="input-field w-full bg-slate-50 text-xs py-2.5 cursor-pointer border-slate-200"
                    >
                      <option value="">-- Select Employee --</option>
                      {users.map((u: any) => (
                        <option key={u.id} value={u.id}>{u.fullName}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Roster Shift Code</label>
                    <select
                      value={assignForm.shiftCategoryId}
                      onChange={(e) => setAssignForm(prev => ({ ...prev, shiftCategoryId: e.target.value }))}
                      className="input-field w-full bg-slate-50 text-xs py-2.5 cursor-pointer border-slate-200"
                    >
                      <option value="">-- Choose Shift Code --</option>
                      {categories.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name} ({c.startTime} - {c.endTime})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Roster Date</label>
                    <input
                      type="date"
                      required
                      value={assignForm.date}
                      onChange={(e) => setAssignForm(prev => ({ ...prev, date: e.target.value }))}
                      className="input-field w-full text-xs py-2 bg-slate-50 border-slate-200"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Administrative Notes (Optional)</label>
                    <textarea
                      placeholder="e.g. Assigned to remote data center support shift..."
                      value={assignForm.notes}
                      onChange={(e) => setAssignForm(prev => ({ ...prev, notes: e.target.value }))}
                      className="input-field w-full text-xs min-h-[60px] resize-none bg-slate-50 border-slate-200"
                    />
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowAssignModal(false)}
                      className="bg-slate-100 hover:bg-slate-250 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={assignShiftMutation.isPending}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-blue-500/10 active:scale-[0.98] transition-all cursor-pointer"
                    >
                      {assignShiftMutation.isPending ? "Assigning..." : "Assign Roster Day"}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
