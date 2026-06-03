"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { PageHeader } from "@/components/PageHeader";
import api from "@/lib/api";
import { 
  Pin, 
  Archive, 
  Trash2, 
  RotateCcw, 
  Calendar as CalendarIcon, 
  Bell, 
  Palette, 
  FolderIcon, 
  Plus, 
  Search, 
  X, 
  Loader2, 
  Check, 
  ChevronLeft, 
  ChevronRight,
  Info,
  Clock,
  Trash
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// Google Keep-like standard color options
const COLOR_PALETTE = [
  { name: "Default", value: "#ffffff" },
  { name: "Red", value: "#f28b82" },
  { name: "Orange", value: "#fbbc04" },
  { name: "Yellow", value: "#fff475" },
  { name: "Green", value: "#ccff90" },
  { name: "Teal", value: "#a7ffeb" },
  { name: "Blue", value: "#cbf0f8" },
  { name: "Dark Blue", value: "#aecbfa" },
  { name: "Purple", value: "#d7aeec" },
  { name: "Pink", value: "#fdcfe8" },
  { name: "Brown", value: "#e6c9a8" },
  { name: "Gray", value: "#e8eaed" },
];

export default function NotesPage() {
  const queryClient = useQueryClient();
  const [currentView, setCurrentView] = useState<"notes" | "reminders" | "archive" | "trash" | "calendar">("notes");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Note Creator State
  const [isCreatorExpanded, setIsCreatorExpanded] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newColor, setNewColor] = useState("#ffffff");
  const [newIsPinned, setNewIsPinned] = useState(false);
  const [newReminderAt, setNewReminderAt] = useState("");
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null); // "new" or note.id

  // Editor Modal State
  const [editingNote, setEditingNote] = useState<any | null>(null);

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());

  // Fetch Notes
  const { data: notes = [], isLoading } = useQuery<any[]>({
    queryKey: ["notes", currentView],
    queryFn: async () => {
      let params = "";
      if (currentView === "archive") {
        params = "?isArchived=true";
      } else if (currentView === "trash") {
        params = "?isTrashed=true";
      } else if (currentView === "reminders") {
        params = "?hasReminder=true";
      }
      const res = await api.get(`/notes${params}`);
      return res.data;
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: any) => api.post("/notes", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      resetCreator();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => api.patch(`/notes/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      if (editingNote) {
        setEditingNote(null);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/notes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });

  const emptyTrashMutation = useMutation({
    mutationFn: async () => api.post("/notes/empty-trash"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });

  const resetCreator = () => {
    setNewTitle("");
    setNewContent("");
    setNewColor("#ffffff");
    setNewIsPinned(false);
    setNewReminderAt("");
    setIsCreatorExpanded(false);
  };

  const handleCreateNote = () => {
    if (!newContent.trim() && !newTitle.trim()) {
      setIsCreatorExpanded(false);
      return;
    }
    createMutation.mutate({
      title: newTitle,
      content: newContent,
      color: newColor,
      isPinned: newIsPinned,
      reminderAt: newReminderAt || null,
      isArchived: currentView === "archive",
    });
  };

  // Filter notes locally for search
  const filteredNotes = notes.filter(note => {
    const titleMatch = note.title?.toLowerCase().includes(searchQuery.toLowerCase());
    const contentMatch = note.content.toLowerCase().includes(searchQuery.toLowerCase());
    return titleMatch || contentMatch;
  });

  // Split into pinned and others (Google Keep style)
  const pinnedNotes = filteredNotes.filter(note => note.isPinned && !note.isArchived && !note.isTrashed);
  const otherNotes = filteredNotes.filter(note => !note.isPinned && !note.isArchived && !note.isTrashed);

  // Calendar Math and Generation
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const generateCalendarDays = () => {
    const totalDays = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    // Padding for previous month
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    // Days of current month
    for (let d = 1; d <= totalDays; d++) {
      days.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), d));
    }

    return days;
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const getNotesForDate = (date: Date) => {
    if (!date) return [];
    return notes.filter(note => {
      if (!note.reminderAt || note.isTrashed) return false;
      const rDate = new Date(note.reminderAt);
      return (
        rDate.getDate() === date.getDate() &&
        rDate.getMonth() === date.getMonth() &&
        rDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const handleCalendarCellClick = (date: Date) => {
    if (!date) return;
    const formattedDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    
    setNewReminderAt(formattedDate);
    setIsCreatorExpanded(true);
    setCurrentView("notes");
    // Scroll smoothly to note creator
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="flex h-screen bg-slate-50/50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <MobileNav />
        
        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <PageHeader 
              title="Notes & Schedule" 
              subtitle="Tulis catatan penting seperti Google Keep dan atur jadwal pengingat (Reminder) terintegrasi dengan Kalender pribadi Anda. Anda dapat mengaktifkan notifikasi Telegram, WhatsApp, atau Email melalui menu Profil."
            />
            
            {/* Search Bar */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Cari catatan..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-sm transition-all"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Navigation Views / Tabs */}
          <div className="flex flex-wrap gap-2 mb-8 bg-slate-100 p-1.5 rounded-2xl w-fit">
            {[
              { id: "notes", label: "Catatan", icon: FolderIcon },
              { id: "reminders", label: "Pengingat", icon: Bell },
              { id: "archive", label: "Arsip", icon: Archive },
              { id: "trash", label: "Sampah", icon: Trash2 },
              { id: "calendar", label: "Kalender Schedule", icon: CalendarIcon },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setCurrentView(tab.id as any);
                  resetCreator();
                }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all",
                  currentView === tab.id 
                    ? "bg-white text-blue-600 shadow-sm" 
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Note Input Box (Google Keep style) - Only in standard Notes / Reminders view */}
          {["notes", "reminders"].includes(currentView) && (
            <div className="flex justify-center mb-10">
              <div 
                className={cn(
                  "w-full max-w-xl bg-white border border-slate-200 shadow-md rounded-2xl transition-all duration-200 overflow-hidden",
                  isCreatorExpanded ? "ring-2 ring-blue-500/10 border-blue-500" : ""
                )}
                style={{ backgroundColor: newColor }}
              >
                {isCreatorExpanded ? (
                  <div className="p-4 space-y-3">
                    <input 
                      type="text" 
                      placeholder="Judul" 
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="w-full bg-transparent border-none outline-none font-bold text-base text-slate-800 placeholder-slate-400"
                    />
                    <textarea 
                      placeholder="Buat catatan..." 
                      rows={3}
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
                      className="w-full bg-transparent border-none outline-none text-sm text-slate-700 placeholder-slate-400 resize-none"
                    />
                    
                    {/* Add Reminder Input */}
                    <div className="flex items-center gap-2 p-2 bg-slate-50/50 rounded-xl border border-slate-100 max-w-fit">
                      <Clock className="w-4 h-4 text-slate-500" />
                      <input 
                        type="datetime-local" 
                        value={newReminderAt}
                        onChange={(e) => setNewReminderAt(e.target.value)}
                        className="bg-transparent border-none outline-none text-xs text-slate-600 font-bold"
                      />
                      {newReminderAt && (
                        <button onClick={() => setNewReminderAt("")} className="p-0.5 hover:bg-slate-200 rounded-full">
                          <X className="w-3.5 h-3.5 text-slate-500" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-3">
                        {/* Pin Button */}
                        <button 
                          onClick={() => setNewIsPinned(!newIsPinned)}
                          className={cn("p-2 rounded-xl transition-all", newIsPinned ? "bg-amber-50 text-amber-600" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600")}
                        >
                          <Pin className="w-4 h-4" />
                        </button>
                        
                        {/* Color Picker */}
                        <div className="relative">
                          <button 
                            onClick={() => setShowColorPicker(showColorPicker === "new" ? null : "new")}
                            className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-xl transition-all"
                          >
                            <Palette className="w-4 h-4" />
                          </button>
                          
                          {showColorPicker === "new" && (
                            <div className="absolute left-0 bottom-10 p-2 bg-white border border-slate-200 rounded-xl shadow-xl flex gap-1 z-30 flex-wrap w-44">
                              {COLOR_PALETTE.map(col => (
                                <button
                                  key={col.value}
                                  onClick={() => {
                                    setNewColor(col.value);
                                    setShowColorPicker(null);
                                  }}
                                  className="w-6 h-6 rounded-full border border-slate-200 transition-all hover:scale-110 flex items-center justify-center shrink-0"
                                  style={{ backgroundColor: col.value }}
                                >
                                  {newColor === col.value && <Check className="w-3 h-3 text-slate-600" />}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button 
                          onClick={resetCreator}
                          className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
                        >
                          Batal
                        </button>
                        <button 
                          onClick={handleCreateNote}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Simpan
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div 
                    onClick={() => setIsCreatorExpanded(true)}
                    className="p-4 flex items-center justify-between cursor-pointer text-slate-400 hover:text-slate-600"
                  >
                    <span className="text-sm font-semibold">Buat catatan...</span>
                    <Plus className="w-5 h-5 text-slate-400" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Grid Notes / Google Keep Layout */}
          {currentView !== "calendar" && (
            <>
              {/* Empty state check */}
              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : filteredNotes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mb-4">
                    <FolderIcon className="w-8 h-8" />
                  </div>
                  <h3 className="font-bold text-slate-700 text-base">Tidak ada catatan ditemukan</h3>
                  <p className="text-slate-500 text-xs mt-1">Buat catatan baru atau ubah filter pencarian Anda.</p>
                </div>
              ) : (
                <div className="space-y-10">
                  {/* Trash Warning / Options */}
                  {currentView === "trash" && (
                    <div className="flex items-center justify-between bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl max-w-xl mx-auto mb-6">
                      <div className="flex items-center gap-2">
                        <Info className="w-5 h-5 shrink-0" />
                        <span className="text-xs font-bold">Catatan di Sampah akan dihapus secara berkala.</span>
                      </div>
                      <button 
                        onClick={() => emptyTrashMutation.mutate()}
                        disabled={emptyTrashMutation.isPending}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                      >
                        <Trash className="w-4 h-4" />
                        Kosongkan Sampah
                      </button>
                    </div>
                  )}

                  {/* Pinned Section */}
                  {pinnedNotes.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">DISEMATKAN</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {pinnedNotes.map(note => (
                          <NoteCard 
                            key={note.id} 
                            note={note} 
                            currentView={currentView}
                            onEdit={setEditingNote} 
                            onUpdate={(data) => updateMutation.mutate({ id: note.id, data })}
                            onDelete={() => deleteMutation.mutate(note.id)}
                            showColorPicker={showColorPicker}
                            setShowColorPicker={setShowColorPicker}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Others Section */}
                  {otherNotes.length > 0 && (
                    <div className="space-y-4">
                      {pinnedNotes.length > 0 && <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">LAINNYA</h4>}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {otherNotes.map(note => (
                          <NoteCard 
                            key={note.id} 
                            note={note} 
                            currentView={currentView}
                            onEdit={setEditingNote} 
                            onUpdate={(data) => updateMutation.mutate({ id: note.id, data })}
                            onDelete={() => deleteMutation.mutate(note.id)}
                            showColorPicker={showColorPicker}
                            setShowColorPicker={setShowColorPicker}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Archived / Trashed items list */}
                  {["archive", "trash"].includes(currentView) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {filteredNotes.map(note => (
                        <NoteCard 
                          key={note.id} 
                          note={note} 
                          currentView={currentView}
                          onEdit={setEditingNote} 
                          onUpdate={(data) => updateMutation.mutate({ id: note.id, data })}
                          onDelete={() => deleteMutation.mutate(note.id)}
                          showColorPicker={showColorPicker}
                          setShowColorPicker={setShowColorPicker}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Calendar / Monthly Schedule View */}
          {currentView === "calendar" && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
              {/* Calendar Controls */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-600">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <h3 className="font-extrabold text-slate-800 text-lg">
                    {currentDate.toLocaleString("default", { month: "long", year: "numeric" })}
                  </h3>
                  <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-600">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
                <button 
                  onClick={() => setCurrentDate(new Date())} 
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-sm transition-all"
                >
                  Hari Ini
                </button>
              </div>

              {/* Grid Calendar */}
              <div className="grid grid-cols-7 gap-px bg-slate-100 border border-slate-150 rounded-2xl overflow-hidden">
                {/* Day Headers */}
                {["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"].map(day => (
                  <div key={day} className="bg-slate-50 py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {day}
                  </div>
                ))}

                {/* Day Cells */}
                {generateCalendarDays().map((day, idx) => {
                  const dayNotes = getNotesForDate(day as Date);
                  const isToday = day && 
                    new Date().getDate() === day.getDate() && 
                    new Date().getMonth() === day.getMonth() && 
                    new Date().getFullYear() === day.getFullYear();

                  return (
                    <div 
                      key={idx} 
                      onClick={() => day && handleCalendarCellClick(day)}
                      className={cn(
                        "bg-white min-h-[120px] p-2 relative flex flex-col group transition-all duration-150",
                        day ? "cursor-pointer hover:bg-slate-50/50" : "bg-slate-50/20"
                      )}
                    >
                      {day && (
                        <>
                          {/* Date label */}
                          <span 
                            className={cn(
                              "w-6 h-6 flex items-center justify-center text-xs font-bold rounded-full mb-1",
                              isToday 
                                ? "bg-blue-600 text-white shadow-sm shadow-blue-600/35" 
                                : "text-slate-700"
                            )}
                          >
                            {day.getDate()}
                          </span>

                          {/* Notes/Events badge list */}
                          <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar max-h-[85px] mt-1">
                            {dayNotes.map(note => (
                              <div
                                key={note.id}
                                onClick={(e) => {
                                  e.stopPropagation(); // Avoid triggering cell click
                                  setEditingNote(note);
                                }}
                                className="p-1.5 rounded-lg border border-slate-200/50 text-[10px] font-bold text-slate-800 truncate shadow-sm transition-all hover:brightness-95 active:scale-95"
                                style={{ backgroundColor: note.color || "#ffffff" }}
                                title={`${note.title || "Catatan"}: ${note.content}`}
                              >
                                <span className="flex items-center gap-1">
                                  {note.isPinned && <Pin className="w-2.5 h-2.5 text-slate-600 shrink-0" />}
                                  {note.title || note.content}
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Edit Note Modal */}
      <AnimatePresence>
        {editingNote && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => handleCreateNote()} // Save and close
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-xl bg-white border border-slate-100 rounded-3xl shadow-2xl overflow-hidden flex flex-col z-10"
              style={{ backgroundColor: editingNote.color || "#ffffff" }}
            >
              <div className="p-6 space-y-4">
                <input 
                  type="text" 
                  placeholder="Judul" 
                  value={editingNote.title || ""}
                  onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
                  className="w-full bg-transparent border-none outline-none font-bold text-lg text-slate-800 placeholder-slate-400"
                />
                
                <textarea 
                  placeholder="Buat catatan..." 
                  rows={6}
                  value={editingNote.content || ""}
                  onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                  className="w-full bg-transparent border-none outline-none text-sm text-slate-700 placeholder-slate-400 resize-none"
                />

                {/* Edit Reminder Input */}
                <div className="flex items-center gap-2 p-2 bg-slate-50/50 rounded-xl border border-slate-100 max-w-fit">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <input 
                    type="datetime-local" 
                    value={editingNote.reminderAt ? new Date(new Date(editingNote.reminderAt).getTime() - new Date(editingNote.reminderAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""}
                    onChange={(e) => setEditingNote({ ...editingNote, reminderAt: e.target.value || null })}
                    className="bg-transparent border-none outline-none text-xs text-slate-600 font-bold"
                  />
                  {editingNote.reminderAt && (
                    <button onClick={() => setEditingNote({ ...editingNote, reminderAt: null })} className="p-0.5 hover:bg-slate-200 rounded-full">
                      <X className="w-3.5 h-3.5 text-slate-500" />
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-150/40">
                  <div className="flex items-center gap-3">
                    {/* Pin Toggle */}
                    <button 
                      onClick={() => setEditingNote({ ...editingNote, isPinned: !editingNote.isPinned })}
                      className={cn("p-2 rounded-xl transition-all", editingNote.isPinned ? "bg-amber-50 text-amber-600" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600")}
                    >
                      <Pin className="w-4 h-4" />
                    </button>

                    {/* Color Picker inside modal */}
                    <div className="relative">
                      <button 
                        onClick={() => setShowColorPicker(showColorPicker === editingNote.id ? null : editingNote.id)}
                        className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-xl transition-all"
                      >
                        <Palette className="w-4 h-4" />
                      </button>
                      
                      {showColorPicker === editingNote.id && (
                        <div className="absolute left-0 bottom-10 p-2 bg-white border border-slate-200 rounded-xl shadow-xl flex gap-1 z-30 flex-wrap w-44">
                          {COLOR_PALETTE.map(col => (
                            <button
                              key={col.value}
                              onClick={() => {
                                setEditingNote({ ...editingNote, color: col.value });
                                setShowColorPicker(null);
                              }}
                              className="w-6 h-6 rounded-full border border-slate-200 transition-all hover:scale-110 flex items-center justify-center shrink-0"
                              style={{ backgroundColor: col.value }}
                            >
                              {editingNote.color === col.value && <Check className="w-3 h-3 text-slate-600" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setEditingNote(null)}
                      className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
                    >
                      Tutup
                    </button>
                    <button 
                      onClick={() => updateMutation.mutate({ id: editingNote.id, data: editingNote })}
                      className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
                    >
                      Simpan Perubahan
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Subcomponent: NoteCard
interface NoteCardProps {
  note: any;
  currentView: string;
  onEdit: (note: any) => void;
  onUpdate: (data: any) => void;
  onDelete: () => void;
  showColorPicker: string | null;
  setShowColorPicker: (val: string | null) => void;
}

function NoteCard({ 
  note, 
  currentView,
  onEdit, 
  onUpdate, 
  onDelete, 
  showColorPicker, 
  setShowColorPicker 
}: NoteCardProps) {
  const formattedReminder = note.reminderAt ? new Date(note.reminderAt).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }) : "";

  return (
    <motion.div 
      layout
      className={cn(
        "rounded-2xl border border-slate-200/80 p-5 shadow-sm group hover:shadow-md transition-all duration-200 flex flex-col justify-between min-h-[160px] relative",
        note.isPinned && currentView === "notes" ? "ring-1 ring-amber-500/20" : ""
      )}
      style={{ backgroundColor: note.color || "#ffffff" }}
    >
      <div onClick={() => currentView !== "trash" && onEdit(note)} className="cursor-pointer space-y-2 flex-1">
        <div className="flex items-start justify-between gap-4">
          <h5 className="font-extrabold text-slate-800 text-sm tracking-tight">{note.title || ""}</h5>
          
          {/* Pinned badge */}
          {note.isPinned && currentView === "notes" && (
            <Pin className="w-3.5 h-3.5 text-amber-600 shrink-0 fill-amber-600" />
          )}
        </div>
        
        <p className="text-slate-600 text-xs leading-relaxed whitespace-pre-wrap">{note.content}</p>
      </div>

      {/* Reminder Pill */}
      {note.reminderAt && (
        <div className={cn("mt-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black w-fit tracking-wider", note.reminderSent ? "bg-slate-100 text-slate-400" : "bg-blue-600/10 text-blue-700")}>
          <Clock className="w-3 h-3" />
          <span>{formattedReminder}</span>
          {note.reminderSent && <span className="text-[8px] font-normal italic">(Sudah terkirim)</span>}
        </div>
      )}

      {/* Action Hover Controls */}
      <div className="mt-4 pt-3 border-t border-slate-150/40 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <div className="flex items-center gap-2">
          {currentView !== "trash" ? (
            <>
              {/* Pin Toggle */}
              <button 
                onClick={() => onUpdate({ isPinned: !note.isPinned })}
                className={cn("p-1.5 rounded-lg hover:bg-slate-100 text-slate-500", note.isPinned ? "text-amber-600" : "")}
                title={note.isPinned ? "Lepas Catatan" : "Sematkan Catatan"}
              >
                <Pin className="w-3.5 h-3.5" />
              </button>

              {/* Color Picker palette */}
              <div className="relative">
                <button 
                  onClick={() => setShowColorPicker(showColorPicker === note.id ? null : note.id)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                  title="Pilih Warna"
                >
                  <Palette className="w-3.5 h-3.5" />
                </button>
                
                {showColorPicker === note.id && (
                  <div className="absolute left-0 bottom-8 p-1.5 bg-white border border-slate-200 rounded-xl shadow-xl flex gap-1 z-30 flex-wrap w-44">
                    {COLOR_PALETTE.map(col => (
                      <button
                        key={col.value}
                        onClick={() => {
                          onUpdate({ color: col.value });
                          setShowColorPicker(null);
                        }}
                        className="w-5 h-5 rounded-full border border-slate-200 transition-all hover:scale-110 flex items-center justify-center shrink-0"
                        style={{ backgroundColor: col.value }}
                      >
                        {note.color === col.value && <Check className="w-2.5 h-2.5 text-slate-600" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Archive Toggle */}
              <button 
                onClick={() => onUpdate({ isArchived: !note.isArchived })}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                title={note.isArchived ? "Unarsip" : "Arsipkan"}
              >
                <Archive className="w-3.5 h-3.5" />
              </button>

              {/* Move to Trash */}
              <button 
                onClick={() => onUpdate({ isTrashed: true, isPinned: false })}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                title="Hapus ke Sampah"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <>
              {/* Restore Note */}
              <button 
                onClick={() => onUpdate({ isTrashed: false })}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                title="Pulihkan Catatan"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              {/* Permanent Delete */}
              <button 
                onClick={() => onDelete()}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-rose-600"
                title="Hapus Permanen"
              >
                <Trash className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
