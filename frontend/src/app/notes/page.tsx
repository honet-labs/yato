"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { Footer } from "@/components/Footer";
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
  Trash,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Heading1,
  Heading2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";
import { useBranding } from "@/context/branding-context";

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

function stripHtml(html: string) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "");
}

function toTimezoneDateTimeLocal(dateString: string, timezone: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";

  try {
    const formatter = new Intl.DateTimeFormat("sv-SE", {
      timeZone: timezone || "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    });
    return formatter.format(date).replace(" ", "T");
  } catch (e) {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
}

function fromTimezoneDateTimeLocal(localString: string, timezone: string): string {
  if (!localString) return "";
  const [datePart, timePart] = localString.split("T");
  if (!datePart || !timePart) return new Date(localString).toISOString();
  
  try {
    const [year, month, day] = datePart.split("-").map(Number);
    const [hour, minute] = timePart.split(":").map(Number);
    
    const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute));
    const tzParts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "Asia/Jakarta",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hourCycle: "h23"
    }).formatToParts(utcDate);
    
    const getPart = (type: string) => Number(tzParts.find(p => p.type === type)?.value || 0);
    
    const tzYear = getPart("year");
    const tzMonth = getPart("month") - 1;
    const tzDay = getPart("day");
    const tzHour = getPart("hour") % 24;
    const tzMin = getPart("minute");
    
    const localEpoch = Date.UTC(year, month - 1, day, hour, minute);
    const tzEpoch = Date.UTC(tzYear, tzMonth, tzDay, tzHour, tzMin);
    
    const diff = localEpoch - tzEpoch;
    return new Date(utcDate.getTime() + diff).toISOString();
  } catch (e) {
    return new Date(localString).toISOString();
  }
}

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
}

function RichTextEditor({ value, onChange, placeholder, minHeight = "120px" }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  // Sync internal editor HTML when external value changes
  useEffect(() => {
    if (editorRef.current) {
      if (editorRef.current.innerHTML !== value) {
        // If we are currently focused and typing, don't force update to prevent cursor jumping
        if (document.activeElement === editorRef.current) {
          return;
        }
        editorRef.current.innerHTML = value || "";
      }
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      onChange(html === "<br>" ? "" : html);
    }
  };

  const execCommand = (command: string, arg: string = "") => {
    document.execCommand(command, false, arg);
    handleInput();
    if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  return (
    <div className="w-full border border-slate-200/60 rounded-xl overflow-hidden bg-slate-50/10">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-50 border-b border-slate-100">
        <button
          type="button"
          onClick={() => execCommand("bold")}
          className="p-1 hover:bg-slate-200 rounded text-slate-600 font-bold"
          title="Bold"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => execCommand("italic")}
          className="p-1 hover:bg-slate-200 rounded text-slate-600 italic"
          title="Italic"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => execCommand("underline")}
          className="p-1 hover:bg-slate-200 rounded text-slate-600 underline"
          title="Underline"
        >
          <Underline className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => execCommand("strikeThrough")}
          className="p-1 hover:bg-slate-200 rounded text-slate-600 line-through"
          title="Strikethrough"
        >
          <Strikethrough className="w-3.5 h-3.5" />
        </button>

        <span className="w-[1px] h-4 bg-slate-200 mx-1" />

        <button
          type="button"
          onClick={() => execCommand("formatBlock", "<h1>")}
          className="p-1 hover:bg-slate-200 rounded text-slate-600 font-extrabold text-[10px]"
          title="Heading 1"
        >
          <Heading1 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => execCommand("formatBlock", "<h2>")}
          className="p-1 hover:bg-slate-200 rounded text-slate-600 font-bold text-[10px]"
          title="Heading 2"
        >
          <Heading2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => execCommand("formatBlock", "<p>")}
          className="p-1.5 px-2 hover:bg-slate-200 rounded text-slate-600 font-bold text-[10px]"
          title="Paragraph"
        >
          P
        </button>

        <span className="w-[1px] h-4 bg-slate-200 mx-1" />

        <button
          type="button"
          onClick={() => execCommand("justifyLeft")}
          className="p-1 hover:bg-slate-200 rounded text-slate-600"
          title="Align Left"
        >
          <AlignLeft className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => execCommand("justifyCenter")}
          className="p-1 hover:bg-slate-200 rounded text-slate-600"
          title="Align Center"
        >
          <AlignCenter className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => execCommand("justifyRight")}
          className="p-1 hover:bg-slate-200 rounded text-slate-600"
          title="Align Right"
        >
          <AlignRight className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => execCommand("justifyFull")}
          className="p-1 hover:bg-slate-200 rounded text-slate-600"
          title="Justify"
        >
          <AlignJustify className="w-3.5 h-3.5" />
        </button>

        <span className="w-[1px] h-4 bg-slate-200 mx-1" />

        <button
          type="button"
          onClick={() => execCommand("insertUnorderedList")}
          className="p-1 hover:bg-slate-200 rounded text-slate-600"
          title="Bullet List"
        >
          <List className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => execCommand("insertOrderedList")}
          className="p-1 hover:bg-slate-200 rounded text-slate-600"
          title="Numbered List"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </button>

        <span className="w-[1px] h-4 bg-slate-200 mx-1" />

        <div className="flex items-center gap-1">
          <select
            onChange={(e) => execCommand("fontSize", e.target.value)}
            className="bg-transparent border-none text-[11px] font-bold outline-none text-slate-600 cursor-pointer"
            defaultValue="3"
          >
            <option value="1">Small</option>
            <option value="3">Normal</option>
            <option value="5">Large</option>
            <option value="7">Huge</option>
          </select>
        </div>
      </div>

      {/* Editor Content Area */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        className="p-3.5 outline-none text-[13px] text-slate-700 bg-white overflow-y-auto rich-note-content"
        data-placeholder={placeholder}
        style={{ minHeight }}
      />
    </div>
  );
}

export default function NotesPage() {
  const queryClient = useQueryClient();
  const { lang } = useLanguage();
  const { appTimezone } = useBranding();
  const [currentView, setCurrentView] = useState("notes" as "notes" | "reminders" | "archive" | "trash" | "calendar");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Note Creator State
  const [isCreatorExpanded, setIsCreatorExpanded] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newColor, setNewColor] = useState("#ffffff");
  const [newIsPinned, setNewIsPinned] = useState(false);
  const [newReminderAt, setNewReminderAt] = useState("");
  const [newRepeatInterval, setNewRepeatInterval] = useState("NONE");
  const [showColorPicker, setShowColorPicker] = useState(null as string | null); // "new" or note.id

  // Editor Modal State
  const [editingNote, setEditingNote] = useState(null as any | null);

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());

  // Fetch Notes
  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["notes", currentView],
    queryFn: async () => {
      let params = "";
      if (currentView === "notes") {
        params = "?hasReminder=false";
      } else if (currentView === "archive") {
        params = "?isArchived=true";
      } else if (currentView === "trash") {
        params = "?isTrashed=true";
      } else if (currentView === "reminders" || currentView === "calendar") {
        params = "?hasReminder=true";
      }
      const res = await api.get(`/notes${params}`);
      return res.data;
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = { ...data };
      if (payload.reminderAt && typeof payload.reminderAt === "string" && !payload.reminderAt.includes("Z")) {
        payload.reminderAt = fromTimezoneDateTimeLocal(payload.reminderAt, appTimezone);
      }
      return api.post("/notes", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      resetCreator();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const payload = { ...data };
      if (payload.reminderAt && typeof payload.reminderAt === "string" && !payload.reminderAt.includes("Z")) {
        payload.reminderAt = fromTimezoneDateTimeLocal(payload.reminderAt, appTimezone);
      }
      return api.patch(`/notes/${id}`, payload);
    },
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
    setNewRepeatInterval("NONE");
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
      repeatInterval: newReminderAt ? newRepeatInterval : "NONE",
      isArchived: currentView === "archive",
    });
  };

  // Filter notes locally for search
  const filteredNotes = notes.filter(note => {
    const titleMatch = note.title?.toLowerCase().includes(searchQuery.toLowerCase());
    const contentMatch = stripHtml(note.content).toLowerCase().includes(searchQuery.toLowerCase());
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
    const days: (Date | null)[] = [];

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
    
    // Format calendar cell date as YYYY-MM-DD in local time
    const cellYear = date.getFullYear();
    const cellMonth = String(date.getMonth() + 1).padStart(2, "0");
    const cellDay = String(date.getDate()).padStart(2, "0");
    const cellDateStr = `${cellYear}-${cellMonth}-${cellDay}`;
    
    return notes.filter(note => {
      if (!note.reminderAt || note.isTrashed) return false;
      
      // Get the note's reminder date formatted as YYYY-MM-DD in target timezone
      const noteDateStr = toTimezoneDateTimeLocal(note.reminderAt, appTimezone).slice(0, 10);
      
      return noteDateStr === cellDateStr;
    });
  };

  const handleCalendarCellClick = (date: Date) => {
    if (!date) return;
    try {
      const formatter = new Intl.DateTimeFormat("sv-SE", {
        timeZone: appTimezone || "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      });
      const formattedDate = formatter.format(date); // YYYY-MM-DD
      setNewReminderAt(`${formattedDate}T09:00`); // default to 09:00 AM in setup timezone
    } catch (e) {
      const formattedDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 10);
      setNewReminderAt(`${formattedDate}T09:00`);
    }
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
        <main className="page-container overflow-y-auto custom-scrollbar">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <PageHeader 
              title="Notes & Schedule" 
              subtitle="Write down important notes like Google Keep and organize your reminders integrated with your personal calendar. You can enable WhatsApp, Telegram, or Email notifications in your profile settings."
            />
            
            {/* Search Bar */}
            <div className="relative w-full md:w-80 group">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Search notes..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-10 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all placeholder:text-slate-400 placeholder:font-medium"
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
              { id: "notes", label: "Notes", icon: FolderIcon },
              { id: "reminders", label: "Reminders", icon: Bell },
              { id: "archive", label: "Archive", icon: Archive },
              { id: "trash", label: "Trash", icon: Trash2 },
              { id: "calendar", label: "Calendar Schedule", icon: CalendarIcon },
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
                      placeholder="Title" 
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="w-full bg-transparent border-none outline-none font-bold text-base text-slate-800 placeholder-slate-400"
                    />
                    <RichTextEditor
                      value={newContent}
                      onChange={setNewContent}
                      placeholder={lang === "EN" ? "Take a note..." : "Buat catatan..."}
                      minHeight="120px"
                    />
                    
                    {/* Add Reminder Input */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-2 p-2 bg-slate-50/50 rounded-xl border border-slate-100 max-w-fit">
                        <Clock className="w-4 h-4 text-slate-500" />
                        <input 
                          type="datetime-local" 
                          value={newReminderAt}
                          onChange={(e) => {
                            setNewReminderAt(e.target.value);
                            if (!e.target.value) setNewRepeatInterval("NONE");
                          }}
                          className="bg-transparent border-none outline-none text-xs text-slate-600 font-bold"
                        />
                        {newReminderAt && (
                          <button onClick={() => { setNewReminderAt(""); setNewRepeatInterval("NONE"); }} className="p-0.5 hover:bg-slate-200 rounded-full">
                            <X className="w-3.5 h-3.5 text-slate-500" />
                          </button>
                        )}
                      </div>
                      
                      {newReminderAt && (
                        <div className="flex items-center gap-2 p-2 bg-slate-50/50 rounded-xl border border-slate-100 max-w-fit">
                          <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider">Repeat:</span>
                          <select
                            value={newRepeatInterval}
                            onChange={(e) => setNewRepeatInterval(e.target.value)}
                            className="bg-transparent border-none outline-none text-xs text-slate-700 font-bold cursor-pointer"
                          >
                            <option value="NONE">{lang === "EN" ? "Does not repeat" : "Tidak berulang"}</option>
                            <option value="MINUTELY">{lang === "EN" ? "Every Minute" : "Setiap Menit"}</option>
                            <option value="HOURLY">{lang === "EN" ? "Hourly" : "Per Jam"}</option>
                            <option value="DAILY">{lang === "EN" ? "Daily" : "Harian"}</option>
                            <option value="WEEKLY">{lang === "EN" ? "Weekly" : "Mingguan"}</option>
                            <option value="MONTHLY">{lang === "EN" ? "Monthly" : "Bulanan"}</option>
                          </select>
                        </div>
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
                          Cancel
                        </button>
                        <button 
                          onClick={handleCreateNote}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div 
                    onClick={() => setIsCreatorExpanded(true)}
                    className="p-4 flex items-center justify-between cursor-pointer text-slate-400 hover:text-slate-600"
                  >
                    <span className="text-sm font-semibold">Take a note...</span>
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
                  <h3 className="font-bold text-slate-700 text-base">No notes found</h3>
                  <p className="text-slate-500 text-xs mt-1">Create a new note or change your search filter.</p>
                </div>
              ) : (
                <div className="space-y-10">
                  {/* Trash Warning / Options */}
                  {currentView === "trash" && (
                    <div className="flex items-center justify-between bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl max-w-xl mx-auto mb-6">
                      <div className="flex items-center gap-2">
                        <Info className="w-5 h-5 shrink-0" />
                        <span className="text-xs font-bold">Notes in trash will be deleted periodically.</span>
                      </div>
                      <button 
                        onClick={() => emptyTrashMutation.mutate()}
                        disabled={emptyTrashMutation.isPending}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                      >
                        <Trash className="w-4 h-4" />
                        Empty Trash
                      </button>
                    </div>
                  )}

                  {/* Pinned Section */}
                  {pinnedNotes.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PINNED</h4>
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
                      {pinnedNotes.length > 0 && <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">OTHERS</h4>}
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
                    {currentDate.toLocaleString(lang === "EN" ? "en-US" : "id-ID", { month: "long", year: "numeric" })}
                  </h3>
                  <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-600">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
                <button 
                  onClick={() => setCurrentDate(new Date())} 
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-sm transition-all"
                >
                  Today
                </button>
              </div>

              {/* Grid Calendar */}
              <div className="grid grid-cols-7 gap-px bg-slate-100 border border-slate-150 rounded-2xl overflow-hidden">
                {/* Day Headers */}
                {(lang === "ID" ? ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"] : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]).map(day => (
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
                                title={`${note.title || "Note"}: ${stripHtml(note.content)}`}
                              >
                                <span className="flex items-center gap-1">
                                  {note.isPinned && <Pin className="w-2.5 h-2.5 text-slate-600 shrink-0" />}
                                  {note.title || stripHtml(note.content)}
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
                  placeholder="Title" 
                  value={editingNote.title || ""}
                  onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
                  className="w-full bg-transparent border-none outline-none font-bold text-lg text-slate-800 placeholder-slate-400"
                />
                
                <RichTextEditor
                  value={editingNote.content || ""}
                  onChange={(val) => setEditingNote({ ...editingNote, content: val })}
                  placeholder={lang === "EN" ? "Take a note..." : "Buat catatan..."}
                  minHeight="200px"
                />

                {/* Edit Reminder Input */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 p-2 bg-slate-50/50 rounded-xl border border-slate-100 max-w-fit">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <input 
                      type="datetime-local" 
                      value={editingNote.reminderAt ? toTimezoneDateTimeLocal(editingNote.reminderAt, appTimezone) : ""}
                      onChange={(e) => {
                        const val = e.target.value || null;
                        setEditingNote({ 
                          ...editingNote, 
                          reminderAt: val, 
                          repeatInterval: val ? (editingNote.repeatInterval || "NONE") : "NONE" 
                        });
                      }}
                      className="bg-transparent border-none outline-none text-xs text-slate-600 font-bold"
                    />
                    {editingNote.reminderAt && (
                      <button onClick={() => setEditingNote({ ...editingNote, reminderAt: null, repeatInterval: "NONE" })} className="p-0.5 hover:bg-slate-200 rounded-full">
                        <X className="w-3.5 h-3.5 text-slate-500" />
                      </button>
                    )}
                  </div>

                  {editingNote.reminderAt && (
                    <div className="flex items-center gap-2 p-2 bg-slate-50/50 rounded-xl border border-slate-100 max-w-fit">
                      <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider">Repeat:</span>
                      <select
                        value={editingNote.repeatInterval || "NONE"}
                        onChange={(e) => setEditingNote({ ...editingNote, repeatInterval: e.target.value })}
                        className="bg-transparent border-none outline-none text-xs text-slate-700 font-bold cursor-pointer"
                      >
                        <option value="NONE">{lang === "EN" ? "Does not repeat" : "Tidak berulang"}</option>
                        <option value="MINUTELY">{lang === "EN" ? "Every Minute" : "Setiap Menit"}</option>
                        <option value="HOURLY">{lang === "EN" ? "Hourly" : "Per Jam"}</option>
                        <option value="DAILY">{lang === "EN" ? "Daily" : "Harian"}</option>
                        <option value="WEEKLY">{lang === "EN" ? "Weekly" : "Mingguan"}</option>
                        <option value="MONTHLY">{lang === "EN" ? "Monthly" : "Bulanan"}</option>
                      </select>
                    </div>
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
                      Close
                    </button>
                    <button 
                      onClick={() => updateMutation.mutate({ id: editingNote.id, data: editingNote })}
                      className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
                    >
                      Save Changes
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
  const { lang } = useLanguage();
  const { appTimezone } = useBranding();
  const formattedReminder = note.reminderAt ? new Date(note.reminderAt).toLocaleString(lang === "EN" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: appTimezone || "Asia/Jakarta"
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
        
        <div 
          className="text-slate-600 text-xs leading-relaxed rich-note-content line-clamp-6 overflow-hidden"
          dangerouslySetInnerHTML={{ __html: note.content || "" }}
        />
      </div>

      {/* Reminder Pill */}
      {note.reminderAt && (
        <div className="mt-4 flex flex-wrap gap-1.5 items-center">
          <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider w-fit", note.reminderSent ? "bg-slate-100 text-slate-400" : "bg-blue-600/10 text-blue-700")}>
            <Clock className="w-3 h-3" />
            <span>{formattedReminder}</span>
            {note.reminderSent && <span className="text-[8px] font-normal italic">(Sent)</span>}
          </div>
          {note.repeatInterval && note.repeatInterval !== "NONE" && (
            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-extrabold bg-indigo-50 text-indigo-600 border border-indigo-100 uppercase tracking-widest w-fit">
              <RotateCcw className="w-2.5 h-2.5" />
              <span>{note.repeatInterval}</span>
            </div>
          )}
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
                title={note.isPinned ? "Unpin Note" : "Pin Note"}
              >
                <Pin className="w-3.5 h-3.5" />
              </button>

              {/* Color Picker palette */}
              <div className="relative">
                <button 
                  onClick={() => setShowColorPicker(showColorPicker === note.id ? null : note.id)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                  title="Choose Color"
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
                title={note.isArchived ? "Unarchive" : "Archive"}
              >
                <Archive className="w-3.5 h-3.5" />
              </button>

              {/* Move to Trash */}
              <button 
                onClick={() => onUpdate({ isTrashed: true, isPinned: false })}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                title="Delete"
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
                title="Restore Note"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              {/* Permanent Delete */}
              <button 
                onClick={() => onDelete()}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-rose-600"
                title="Delete Permanently"
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
