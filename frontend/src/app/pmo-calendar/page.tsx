"use client";

import { PageHeader } from "@/components/PageHeader";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import api from "@/lib/api";
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  Filter,
  Users,
  CheckSquare,
  Flag,
  Edit2,
  Trash2,
  ListTodo,
  Info,
  CalendarDays,
  GanttChartSquare,
  FolderKanban,
  CheckCircle,
  AlertTriangle,
  FileText,
  User,
  Settings,
  X,
  Link2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// Category definitions for Calendar Notes
const NOTE_CATEGORIES = [
  { id: "GENERAL", label: "General Note", color: "bg-emerald-50 text-emerald-700 border-emerald-250", dot: "bg-emerald-500" },
  { id: "BLOCKER", label: "Blocker / Risk", color: "bg-rose-50 text-rose-700 border-rose-250", dot: "bg-rose-500" },
  { id: "STANDUP", label: "Standup Update", color: "bg-blue-50 text-blue-700 border-blue-250", dot: "bg-blue-500" },
  { id: "IDEA", label: "Idea / Insight", color: "bg-purple-50 text-purple-700 border-purple-250", dot: "bg-purple-500" }
];

export default function PmoCalendarPage() {
  const queryClient = useQueryClient();

  // Navigation and Tabs state
  const [activeTab, setActiveTab] = useState<"calendar" | "timeline" | "projects">("calendar");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("ALL");
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>("ALL");

  // Date states for Monthly/Weekly calendar views
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Modals state
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  // Editing items state
  const [editingProject, setEditingProject] = useState<any | null>(null);
  const [editingMilestone, setEditingMilestone] = useState<any | null>(null);
  const [editingNote, setEditingNote] = useState<any | null>(null);
  const [editingTask, setEditingTask] = useState<any | null>(null);

  // Project Form State
  const [projectForm, setProjectForm] = useState({
    name: "",
    description: "",
    startDate: "",
    endDate: "",
    status: "PLANNING",
    colorCode: "#4F46E5"
  });

  // Milestone Form State
  const [milestoneForm, setMilestoneForm] = useState({
    projectId: "",
    title: "",
    description: "",
    dueDate: "",
    isReached: false
  });

  // Note Form State
  const [noteForm, setNoteForm] = useState({
    targetDate: "",
    title: "",
    content: "",
    category: "GENERAL"
  });

  // Task Form State (Extended)
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    status: "NOT_STARTED",
    priority: "MEDIUM",
    taskType: "TASK",
    startDate: "",
    dueDate: "",
    projectId: "",
    assigneeId: "",
    dependencyIds: [] as string[]
  });

  // Dynamic values helper
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  // Queries
  const { data: projects = [] } = useQuery<any[]>({
    queryKey: ["pmo-projects"],
    queryFn: async () => {
      const res = await api.get("/pmo/projects");
      return res.data;
    }
  });

  const { data: milestones = [] } = useQuery<any[]>({
    queryKey: ["pmo-milestones"],
    queryFn: async () => {
      const res = await api.get("/pmo/milestones");
      return res.data;
    }
  });

  const { data: calendarNotes = [] } = useQuery<any[]>({
    queryKey: ["pmo-calendar-notes"],
    queryFn: async () => {
      const res = await api.get("/pmo/calendar-notes");
      return res.data;
    }
  });

  const { data: tasks = [] } = useQuery<any[]>({
    queryKey: ["tasks"],
    queryFn: async () => {
      const res = await api.get("/tasks");
      return res.data;
    }
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await api.get("/users");
      return res.data;
    }
  });

  // Mutations
  const projectMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingProject) {
        return (await api.patch(`/pmo/projects/${editingProject.id}`, payload)).data;
      }
      return (await api.post("/pmo/projects", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pmo-projects"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setIsProjectModalOpen(false);
      setEditingProject(null);
    }
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/pmo/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pmo-projects"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    }
  });

  const milestoneMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingMilestone) {
        return (await api.patch(`/pmo/milestones/${editingMilestone.id}`, payload)).data;
      }
      return (await api.post("/pmo/milestones", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pmo-milestones"] });
      queryClient.invalidateQueries({ queryKey: ["pmo-projects"] });
      setIsMilestoneModalOpen(false);
      setEditingMilestone(null);
    }
  });

  const deleteMilestoneMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/pmo/milestones/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pmo-milestones"] });
      queryClient.invalidateQueries({ queryKey: ["pmo-projects"] });
    }
  });

  const noteMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingNote) {
        return (await api.patch(`/pmo/calendar-notes/${editingNote.id}`, payload)).data;
      }
      return (await api.post("/pmo/calendar-notes", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pmo-calendar-notes"] });
      setIsNoteModalOpen(false);
      setEditingNote(null);
    }
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/pmo/calendar-notes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pmo-calendar-notes"] });
    }
  });

  const taskMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingTask) {
        return (await api.patch(`/tasks/${editingTask.id}`, payload)).data;
      }
      return (await api.post("/tasks", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["pmo-projects"] });
      setIsTaskModalOpen(false);
      setEditingTask(null);
    }
  });

  // Filters application
  const filteredTasks = useMemo(() => {
    return tasks.filter((t: any) => {
      if (selectedProjectId !== "ALL" && t.projectId !== selectedProjectId) return false;
      if (selectedAssigneeId !== "ALL" && t.assigneeId !== selectedAssigneeId) return false;
      return true;
    });
  }, [tasks, selectedProjectId, selectedAssigneeId]);

  const filteredMilestones = useMemo(() => {
    return milestones.filter((m: any) => {
      if (selectedProjectId !== "ALL" && m.projectId !== selectedProjectId) return false;
      return true;
    });
  }, [milestones, selectedProjectId]);

  // Calendar calculations
  const calendarCells = useMemo(() => {
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0);

    // Days in current month
    const totalDays = endOfMonth.getDate();

    // Padding day indices (Sunday = 0, Monday = 1, etc.)
    const startDayOfWeek = startOfMonth.getDay();
    const cells = [];

    // Pre-padding from previous month
    const prevMonthEnd = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      cells.push({
        date: new Date(currentYear, currentMonth - 1, prevMonthEnd - i),
        isCurrentMonth: false
      });
    }

    // Current month cells
    for (let day = 1; day <= totalDays; day++) {
      cells.push({
        date: new Date(currentYear, currentMonth, day),
        isCurrentMonth: true
      });
    }

    // Post-padding to align exactly with 7-column matrix rows
    const totalCellsSoFar = cells.length;
    const paddingNeeded = 42 - totalCellsSoFar; // 6 rows of 7 days
    for (let i = 1; i <= paddingNeeded; i++) {
      cells.push({
        date: new Date(currentYear, currentMonth + 1, i),
        isCurrentMonth: false
      });
    }

    return cells;
  }, [currentYear, currentMonth]);

  // Month navigation
  const prevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };
  const nextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };
  const goToday = () => {
    setCurrentDate(new Date());
  };

  // Format Helper
  const formatDateKey = (date: Date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Group events by target date
  const eventsByDate = useMemo(() => {
    const groups: Record<string, { tasks: any[]; milestones: any[]; notes: any[] }> = {};

    filteredTasks.forEach((task: any) => {
      // Use dueDate as default date if startDate is not set
      const dateVal = task.startDate || task.dueDate;
      if (dateVal) {
        const key = formatDateKey(new Date(dateVal));
        if (!groups[key]) groups[key] = { tasks: [], milestones: [], notes: [] };
        groups[key].tasks.push(task);
      }
    });

    filteredMilestones.forEach((ms: any) => {
      if (ms.dueDate) {
        const key = formatDateKey(new Date(ms.dueDate));
        if (!groups[key]) groups[key] = { tasks: [], milestones: [], notes: [] };
        groups[key].milestones.push(ms);
      }
    });

    calendarNotes.forEach((n: any) => {
      if (n.targetDate) {
        const key = formatDateKey(new Date(n.targetDate));
        if (!groups[key]) groups[key] = { tasks: [], milestones: [], notes: [] };
        groups[key].notes.push(n);
      }
    });

    return groups;
  }, [filteredTasks, filteredMilestones, calendarNotes]);

  // Resource Loading Map
  const resourceLoading = useMemo(() => {
    const loadingMap: Record<string, Record<string, number>> = {}; // DateKey -> AssigneeId -> TaskCount

    tasks.forEach((t: any) => {
      if (t.status !== "DONE" && t.assigneeId) {
        const start = t.startDate ? new Date(t.startDate) : t.dueDate ? new Date(t.dueDate) : null;
        const end = t.dueDate ? new Date(t.dueDate) : start;

        if (start && end) {
          const curr = new Date(start);
          while (curr <= end) {
            const key = formatDateKey(curr);
            if (!loadingMap[key]) loadingMap[key] = {};
            loadingMap[key][t.assigneeId] = (loadingMap[key][t.assigneeId] || 0) + 1;
            curr.setDate(curr.getDate() + 1);
            if (curr.getTime() > end.getTime() + 86400000 * 30) break; // Safeguard limit
          }
        }
      }
    });

    return loadingMap;
  }, [tasks]);

  // Drag and Drop Logic
  const handleDragStart = (e: React.DragEvent, id: string, type: "task" | "milestone" | "note") => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ id, type }));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDropOnDay = (e: React.DragEvent, date: Date) => {
    e.preventDefault();
    try {
      const dataStr = e.dataTransfer.getData("text/plain");
      if (!dataStr) return;
      const { id, type } = JSON.parse(dataStr);
      const targetDateStr = formatDateKey(date);

      if (type === "task") {
        const matchingTask = tasks.find((t: any) => t.id === id);
        if (matchingTask) {
          // Adjust dates maintaining exact offset if startDate and dueDate are both set
          const payload: any = {};
          if (matchingTask.startDate && matchingTask.dueDate) {
            const oldStart = new Date(matchingTask.startDate);
            const oldDue = new Date(matchingTask.dueDate);
            const diffMs = oldDue.getTime() - oldStart.getTime();

            const newStart = new Date(targetDateStr);
            const newDue = new Date(newStart.getTime() + diffMs);

            payload.startDate = newStart.toISOString();
            payload.dueDate = newDue.toISOString();
          } else {
            payload.dueDate = new Date(targetDateStr).toISOString();
            payload.startDate = new Date(targetDateStr).toISOString();
          }

          api.patch(`/tasks/${id}`, payload).then(() => {
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            queryClient.invalidateQueries({ queryKey: ["pmo-projects"] });
          });
        }
      } else if (type === "milestone") {
        api.patch(`/pmo/milestones/${id}`, { dueDate: new Date(targetDateStr).toISOString() }).then(() => {
          queryClient.invalidateQueries({ queryKey: ["pmo-milestones"] });
          queryClient.invalidateQueries({ queryKey: ["pmo-projects"] });
        });
      } else if (type === "note") {
        api.patch(`/pmo/calendar-notes/${id}`, { targetDate: new Date(targetDateStr).toISOString() }).then(() => {
          queryClient.invalidateQueries({ queryKey: ["pmo-calendar-notes"] });
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Modals Open Form Setup
  const openNewNoteModal = (dateStr: string) => {
    setEditingNote(null);
    setNoteForm({
      targetDate: dateStr,
      title: "",
      content: "",
      category: "GENERAL"
    });
    setIsNoteModalOpen(true);
  };

  const openEditNoteModal = (note: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNote(note);
    setNoteForm({
      targetDate: note.targetDate.split("T")[0],
      title: note.title,
      content: note.content || "",
      category: note.category || "GENERAL"
    });
    setIsNoteModalOpen(true);
  };

  const openNewProjectModal = () => {
    setEditingProject(null);
    setProjectForm({
      name: "",
      description: "",
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date(Date.now() + 86400000 * 30).toISOString().split("T")[0],
      status: "PLANNING",
      colorCode: "#4F46E5"
    });
    setIsProjectModalOpen(true);
  };

  const openEditProjectModal = (proj: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProject(proj);
    setProjectForm({
      name: proj.name,
      description: proj.description || "",
      startDate: proj.startDate.split("T")[0],
      endDate: proj.endDate.split("T")[0],
      status: proj.status,
      colorCode: proj.colorCode || "#4F46E5"
    });
    setIsProjectModalOpen(true);
  };

  const openNewMilestoneModal = () => {
    setEditingMilestone(null);
    setMilestoneForm({
      projectId: projects[0]?.id || "",
      title: "",
      description: "",
      dueDate: new Date().toISOString().split("T")[0],
      isReached: false
    });
    setIsMilestoneModalOpen(true);
  };

  const openEditMilestoneModal = (ms: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingMilestone(ms);
    setMilestoneForm({
      projectId: ms.projectId,
      title: ms.title,
      description: ms.description || "",
      dueDate: ms.dueDate.split("T")[0],
      isReached: ms.isReached
    });
    setIsMilestoneModalOpen(true);
  };

  const openNewTaskModal = (dateStr?: string) => {
    setEditingTask(null);
    setTaskForm({
      title: "",
      description: "",
      status: "NOT_STARTED",
      priority: "MEDIUM",
      taskType: "TASK",
      startDate: dateStr || new Date().toISOString().split("T")[0],
      dueDate: dateStr || new Date().toISOString().split("T")[0],
      projectId: selectedProjectId !== "ALL" ? selectedProjectId : projects[0]?.id || "",
      assigneeId: "",
      dependencyIds: []
    });
    setIsTaskModalOpen(true);
  };

  const openEditTaskModal = (task: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      description: task.description || "",
      status: task.status || "NOT_STARTED",
      priority: task.priority || "MEDIUM",
      taskType: task.taskType || "TASK",
      startDate: task.startDate ? task.startDate.split("T")[0] : "",
      dueDate: task.dueDate ? task.dueDate.split("T")[0] : "",
      projectId: task.projectId || "",
      assigneeId: task.assigneeId || "",
      dependencyIds: task.dependencies?.map((d: any) => d.id) || []
    });
    setIsTaskModalOpen(true);
  };

  // Timeline (Gantt) configuration
  const timelineDays = useMemo(() => {
    // Generates 30 days starting from start of current visible month
    const list = [];
    const base = new Date(currentYear, currentMonth, 1);
    for (let i = 0; i < 30; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      list.push(d);
    }
    return list;
  }, [currentYear, currentMonth]);

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-800">
      <MobileNav />
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        <main className="page-container p-6 md:p-8 flex-1 overflow-x-hidden">
          <div className="w-full max-w-[1600px] mx-auto">
            {/* Page Header */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8 gap-4">
              <PageHeader title="PMO Calendar & Timeline" subtitle="Unified calendar, notes, and milestones for project managers." />

              {/* View Selector Tabs */}
              <div className="bg-white p-1 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-1 self-start lg:self-auto">
                <button
                  onClick={() => setActiveTab("calendar")}
                  className={cn(
                    "px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all duration-200 active:scale-95",
                    activeTab === "calendar" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  <CalendarDays className="w-4 h-4" /> Calendar
                </button>
                <button
                  onClick={() => setActiveTab("timeline")}
                  className={cn(
                    "px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all duration-200 active:scale-95",
                    activeTab === "timeline" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  <GanttChartSquare className="w-4 h-4" /> Timeline (Gantt)
                </button>
                <button
                  onClick={() => setActiveTab("projects")}
                  className={cn(
                    "px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all duration-200 active:scale-95",
                    activeTab === "projects" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  <FolderKanban className="w-4 h-4" /> Projects Hub
                </button>
              </div>
            </div>

            {/* Filter controls panel */}
            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-wrap gap-4 items-center justify-between mb-6">
              <div className="flex flex-wrap items-center gap-3.5">
                {/* Project Filter */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Project:</span>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white"
                  >
                    <option value="ALL">All Projects</option>
                    {projects.map((proj) => (
                      <option key={proj.id} value={proj.id}>{proj.name}</option>
                    ))}
                  </select>
                </div>

                {/* Assignee Filter */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Assignee:</span>
                  <select
                    value={selectedAssigneeId}
                    onChange={(e) => setSelectedAssigneeId(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white"
                  >
                    <option value="ALL">All Team Members</option>
                    {users.map((u: any) => (
                      <option key={u.id} value={u.id}>{u.fullName || u.username}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quick Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openNewTaskModal()}
                  className="bg-white hover:bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-2 transition-all active:scale-95 shadow-sm"
                >
                  <Plus className="w-4 h-4 text-slate-500" /> Add Task
                </button>
                <button
                  onClick={openNewProjectModal}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all active:scale-95 shadow-md shadow-indigo-600/10"
                >
                  <Plus className="w-4 h-4" /> New Project
                </button>
              </div>
            </div>

            {/* TAB CONTENT: CALENDAR VIEW */}
            {activeTab === "calendar" && (
              <div className="space-y-6">
                {/* Calendar Navigation and Ribbon */}
                <div className="flex items-center justify-between bg-white px-6 py-4 border border-slate-100 rounded-3xl shadow-sm">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
                      {new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(currentDate)}
                    </h2>
                    <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-150">
                      <button onClick={prevMonth} className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition-all">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button onClick={nextMonth} className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition-all">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <button onClick={goToday} className="px-3.5 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all">
                    Today
                  </button>
                </div>

                {/* Calendar Grid Matrix */}
                <div className="bg-white border border-slate-150/80 rounded-[2rem] shadow-sm overflow-hidden">
                  {/* Days of the week header */}
                  <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                      <div key={day} className="py-3.5 text-center text-xs font-black text-slate-400 uppercase tracking-widest">
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Days grid */}
                  <div className="grid grid-cols-7 grid-rows-6 divide-x divide-y divide-slate-100 bg-slate-100/30">
                    {calendarCells.map(({ date, isCurrentMonth }, idx) => {
                      const dateKey = formatDateKey(date);
                      const isToday = dateKey === formatDateKey(new Date());
                      const dayEvents = eventsByDate[dateKey] || { tasks: [], milestones: [], notes: [] };

                      // Calculate load indicator from other users tasks
                      const dailyLoad = resourceLoading[dateKey] || {};
                      const loadCount = Object.values(dailyLoad).reduce((a, b) => a + b, 0);

                      return (
                        <div
                          key={idx}
                          className={cn(
                            "min-h-[120px] bg-white p-2 flex flex-col gap-1 transition-all relative group/cell select-none",
                            !isCurrentMonth && "bg-slate-50/40 opacity-50",
                            isToday && "bg-indigo-50/15"
                          )}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => handleDropOnDay(e, date)}
                          onMouseEnter={() => setHoveredDay(dateKey)}
                          onMouseLeave={() => setHoveredDay(null)}
                        >
                          {/* Date Header inside cell */}
                          <div className="flex items-center justify-between mb-1">
                            <span
                              className={cn(
                                "text-xs font-bold flex items-center justify-center w-6 h-6 rounded-full transition-all",
                                isToday ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/25" : "text-slate-600",
                                !isCurrentMonth && "text-slate-400 font-medium"
                              )}
                            >
                              {date.getDate()}
                            </span>

                            {/* Resource Load Bar */}
                            {loadCount > 0 && (
                              <span
                                className={cn(
                                  "px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider",
                                  loadCount > 4 ? "bg-rose-100 text-rose-700" : loadCount > 2 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                                )}
                                title={`Total resource load: ${loadCount} concurrent active tasks`}
                              >
                                {loadCount} Load
                              </span>
                            )}
                          </div>

                          {/* Render Events */}
                          <div className="flex-1 space-y-1 overflow-y-auto max-h-[85px] custom-scrollbar">
                            {/* Notes */}
                            {dayEvents.notes.map((n) => {
                              const category = NOTE_CATEGORIES.find(c => c.id === n.category) || NOTE_CATEGORIES[0];
                              return (
                                <div
                                  key={n.id}
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, n.id, "note")}
                                  onClick={(e) => openEditNoteModal(n, e)}
                                  className={cn(
                                    "px-2 py-1 text-[10px] font-bold rounded-lg border flex items-center gap-1 cursor-pointer hover:shadow-sm active:scale-95 transition-all truncate",
                                    category.color
                                  )}
                                >
                                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", category.dot)} />
                                  <span>{n.title}</span>
                                </div>
                              );
                            })}

                            {/* Milestones */}
                            {dayEvents.milestones.map((m) => (
                              <div
                                key={m.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, m.id, "milestone")}
                                onClick={(e) => openEditMilestoneModal(m, e)}
                                className={cn(
                                  "px-2 py-1 text-[10px] font-bold rounded-lg border cursor-pointer hover:shadow-sm active:scale-95 transition-all truncate bg-purple-50 text-purple-700 border-purple-200",
                                  m.isReached && "bg-emerald-50 text-emerald-700 border-emerald-250 line-through"
                                )}
                              >
                                🎯 {m.title}
                              </div>
                            ))}

                            {/* Tasks */}
                            {dayEvents.tasks.map((t) => (
                              <div
                                key={t.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, t.id, "task")}
                                onClick={(e) => openEditTaskModal(t, e)}
                                className={cn(
                                  "px-2 py-1 text-[10px] font-bold rounded-lg border cursor-pointer hover:shadow-sm active:scale-95 transition-all truncate bg-white text-slate-700 border-slate-200 hover:border-slate-350 shadow-sm/10",
                                  t.status === "DONE" && "opacity-60 bg-slate-50 border-slate-200 line-through"
                                )}
                              >
                                <span className={cn(
                                  "inline-block w-1.5 h-1.5 rounded-full mr-1",
                                  t.priority === "HIGH" ? "bg-rose-500" : t.priority === "MEDIUM" ? "bg-amber-500" : "bg-slate-400"
                                )} />
                                {t.title}
                              </div>
                            ))}
                          </div>

                          {/* Quick Create Button Overlay */}
                          {hoveredDay === dateKey && (
                            <div className="absolute bottom-1 right-1 flex items-center gap-0.5 opacity-0 group-hover/cell:opacity-100 transition-opacity">
                              <button
                                onClick={() => openNewNoteModal(dateKey)}
                                className="p-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg shadow transition-all scale-90 hover:scale-100"
                                title="Add Calendar Note"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => openNewTaskModal(dateKey)}
                                className="p-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow transition-all scale-90 hover:scale-100"
                                title="Add Task"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: TIMELINE / GANTT VIEW */}
            {activeTab === "timeline" && (
              <div className="bg-white border border-slate-150 rounded-[2.5rem] p-6 shadow-sm overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Timeline Schedule Grid</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Month:</span>
                    <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-200">
                      <button onClick={prevMonth} className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition-all">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-extrabold px-2 text-slate-700">
                        {new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(currentDate)}
                      </span>
                      <button onClick={nextMonth} className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition-all">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Timeline Grid Container */}
                <div className="overflow-x-auto custom-scrollbar border border-slate-100 rounded-3xl">
                  <div className="min-w-[1200px] divide-y divide-slate-100">
                    {/* Header: Dates */}
                    <div className="flex bg-slate-50/60 sticky top-0 z-10">
                      <div className="w-64 p-4 shrink-0 font-black text-xs text-slate-400 uppercase tracking-widest border-r border-slate-100">
                        Projects & Tasks
                      </div>
                      <div className="flex-1 flex divide-x divide-slate-100/50">
                        {timelineDays.map((day, idx) => {
                          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                          return (
                            <div
                              key={idx}
                              className={cn(
                                "flex-1 py-3 text-center shrink-0 min-w-[42px] flex flex-col items-center justify-center gap-0.5",
                                isWeekend && "bg-slate-100/30"
                              )}
                            >
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                {day.toLocaleDateString("en-US", { weekday: "narrow" })}
                              </span>
                              <span className="text-xs font-bold text-slate-700">{day.getDate()}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Timeline Data Tracks */}
                    {projects.map((proj) => {
                      // Get tasks linked to this project
                      const projTasks = filteredTasks.filter((t: any) => t.projectId === proj.id);

                      return (
                        <div key={proj.id} className="divide-y divide-slate-50">
                          {/* Project Row track */}
                          <div className="flex items-center hover:bg-slate-50/20 group">
                            <div className="w-64 p-4 shrink-0 border-r border-slate-100 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 overflow-hidden">
                                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: proj.colorCode }} />
                                <span className="font-extrabold text-sm text-slate-900 truncate">{proj.name}</span>
                              </div>
                              <button
                                onClick={(e) => openEditProjectModal(proj, e)}
                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Project Duration Bar */}
                            <div className="flex-1 flex relative items-center h-14 bg-slate-50/20">
                              {/* Background Day lines */}
                              <div className="absolute inset-0 flex divide-x divide-slate-100/40 pointer-events-none">
                                {timelineDays.map((_, i) => (
                                  <div key={i} className="flex-1 min-w-[42px] h-full" />
                                ))}
                              </div>

                              {/* Render Project Gantt Bar if overlaps */}
                              {(() => {
                                const startLimit = timelineDays[0];
                                const endLimit = timelineDays[timelineDays.length - 1];
                                const projStart = new Date(proj.startDate);
                                const projEnd = new Date(proj.endDate);

                                if (projEnd < startLimit || projStart > endLimit) return null;

                                const startIndex = timelineDays.findIndex(d => formatDateKey(d) === formatDateKey(projStart));
                                const endIndex = timelineDays.findIndex(d => formatDateKey(d) === formatDateKey(projEnd));

                                const startOffset = startIndex !== -1 ? startIndex : 0;
                                const endOffset = endIndex !== -1 ? endIndex : timelineDays.length - 1;
                                const span = endOffset - startOffset + 1;

                                return (
                                  <div
                                    className="absolute h-8 rounded-xl px-3 flex items-center font-bold text-xs text-white shadow-sm/10 transition-all select-none"
                                    style={{
                                      backgroundColor: proj.colorCode,
                                      left: `calc((${startOffset} / ${timelineDays.length}) * 100%)`,
                                      width: `calc((${span} / ${timelineDays.length}) * 100%)`
                                    }}
                                  >
                                    <span className="truncate">{proj.name} ({span} days)</span>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Task Rows under Project */}
                          {projTasks.map((task: any) => (
                            <div key={task.id} className="flex items-center hover:bg-slate-50/40 group">
                              <div className="w-64 p-3 pl-8 shrink-0 border-r border-slate-100 flex items-center justify-between gap-2 bg-slate-50/30">
                                <div className="flex items-center gap-2 overflow-hidden">
                                  <span className={cn(
                                    "w-1.5 h-1.5 rounded-full shrink-0",
                                    task.status === "DONE" ? "bg-emerald-500" : task.status === "BLOCKED" ? "bg-rose-500" : "bg-indigo-500"
                                  )} />
                                  <span className={cn("font-semibold text-xs text-slate-700 truncate", task.status === "DONE" && "line-through opacity-60")}>
                                    {task.title}
                                  </span>
                                </div>
                                <button
                                  onClick={(e) => openEditTaskModal(task, e)}
                                  className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {/* Task Timeline Duration Bar */}
                              <div className="flex-1 flex relative items-center h-12">
                                <div className="absolute inset-0 flex divide-x divide-slate-100/40 pointer-events-none">
                                  {timelineDays.map((_, i) => (
                                    <div key={i} className="flex-1 min-w-[42px] h-full" />
                                  ))}
                                </div>

                                {(() => {
                                  const startLimit = timelineDays[0];
                                  const endLimit = timelineDays[timelineDays.length - 1];

                                  const tStartVal = task.startDate || task.dueDate;
                                  const tDueVal = task.dueDate || tStartVal;

                                  if (!tStartVal) return null;

                                  const taskStart = new Date(tStartVal);
                                  const taskEnd = new Date(tDueVal);

                                  if (taskEnd < startLimit || taskStart > endLimit) return null;

                                  const startIndex = timelineDays.findIndex(d => formatDateKey(d) === formatDateKey(taskStart));
                                  const endIndex = timelineDays.findIndex(d => formatDateKey(d) === formatDateKey(taskEnd));

                                  const startOffset = startIndex !== -1 ? startIndex : 0;
                                  const endOffset = endIndex !== -1 ? endIndex : timelineDays.length - 1;
                                  const span = endOffset - startOffset + 1;

                                  return (
                                    <div
                                      draggable
                                      onDragStart={(e) => handleDragStart(e, task.id, "task")}
                                      className={cn(
                                        "absolute h-7 rounded-lg px-2 flex items-center justify-between text-[11px] font-bold shadow-sm cursor-grab active:cursor-grabbing hover:brightness-95 transition-all select-none border",
                                        task.status === "DONE"
                                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                          : task.status === "BLOCKED"
                                            ? "bg-rose-50 text-rose-800 border-rose-200"
                                            : "bg-indigo-50 text-indigo-800 border-indigo-200"
                                      )}
                                      style={{
                                        left: `calc((${startOffset} / ${timelineDays.length}) * 100%)`,
                                        width: `calc((${span} / ${timelineDays.length}) * 100%)`
                                      }}
                                    >
                                      <span className="truncate">{task.title}</span>

                                      {/* Dependency Tag Indicator */}
                                      {task.dependencies && task.dependencies.length > 0 && (
                                        <span title={`Depends on: ${task.dependencies.map((d: any) => d.title).join(", ")}`}>
                                          <Link2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}

                    {projects.length === 0 && (
                      <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-wider text-xs">
                        No active projects. Add a project to visualize the timeline track.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: PROJECTS HUB */}
            {activeTab === "projects" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map((proj) => {
                  const projTasks = tasks.filter((t: any) => t.projectId === proj.id);
                  const completedCount = projTasks.filter((t: any) => t.status === "DONE").length;
                  const percent = projTasks.length > 0 ? Math.round((completedCount / projTasks.length) * 100) : 0;

                  return (
                    <div key={proj.id} className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all group">
                      <div>
                        {/* Project title card header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-2.5">
                            <span className="w-4 h-4 rounded-xl shrink-0" style={{ backgroundColor: proj.colorCode }} />
                            <h3 className="font-extrabold text-base text-slate-900 group-hover:text-indigo-600 transition-colors">{proj.name}</h3>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => openEditProjectModal(proj, e)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition-all"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm("Delete project? This sets associated tasks project to none.")) {
                                  deleteProjectMutation.mutate(proj.id);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <p className="text-xs text-slate-500 line-clamp-2 mb-4 leading-relaxed">{proj.description || "No project description provided."}</p>

                        {/* Date info */}
                        <div className="flex items-center gap-4 text-xs font-bold text-slate-500 mb-6 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-450" />
                            <span>{new Date(proj.startDate).toLocaleDateString()}</span>
                          </div>
                          <span>&rarr;</span>
                          <div className="flex items-center gap-1.5">
                            <CalendarIcon className="w-3.5 h-3.5 text-slate-450" />
                            <span>{new Date(proj.endDate).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
                          <span>Progress</span>
                          <span>{percent}% ({completedCount}/{projTasks.length})</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-600 rounded-full transition-all" style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Create Project Empty Card */}
                <button
                  onClick={openNewProjectModal}
                  className="bg-white border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-3xl p-8 flex flex-col items-center justify-center gap-3 text-center transition-all group min-h-[220px]"
                >
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:bg-indigo-50 transition-colors">
                    <Plus className="w-6 h-6 text-slate-450 group-hover:text-indigo-600" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-800">Add New Project</h4>
                    <p className="text-xs text-slate-400 mt-1">Initiate project container & timeline track</p>
                  </div>
                </button>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ==========================================
          MODALS
      ========================================== */}

      {/* PROJECT MODAL */}
      <AnimatePresence>
        {isProjectModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2rem] border border-slate-100 w-full max-w-lg overflow-hidden shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-lg font-black text-slate-900">{editingProject ? "Edit Project" : "New Project"}</h3>
                <button onClick={() => setIsProjectModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  projectMutation.mutate(projectForm);
                }}
                className="space-y-4 text-xs font-semibold text-slate-700"
              >
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Project Name</label>
                  <input
                    type="text"
                    required
                    value={projectForm.name}
                    onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Description</label>
                  <textarea
                    value={projectForm.description}
                    onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500 focus:bg-white h-24 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Start Date</label>
                    <input
                      type="date"
                      required
                      value={projectForm.startDate}
                      onChange={(e) => setProjectForm({ ...projectForm, startDate: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">End Date</label>
                    <input
                      type="date"
                      required
                      value={projectForm.endDate}
                      onChange={(e) => setProjectForm({ ...projectForm, endDate: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Status</label>
                    <select
                      value={projectForm.status}
                      onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500 focus:bg-white"
                    >
                      <option value="PLANNING">Planning</option>
                      <option value="ACTIVE">Active</option>
                      <option value="ON_HOLD">On Hold</option>
                      <option value="COMPLETED">Completed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Color Tag</label>
                    <input
                      type="color"
                      value={projectForm.colorCode}
                      onChange={(e) => setProjectForm({ ...projectForm, colorCode: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 h-10 outline-none cursor-pointer"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={projectMutation.isPending}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-md shadow-indigo-600/10 flex items-center justify-center gap-2"
                >
                  {projectMutation.isPending && <Clock className="w-4 h-4 animate-spin" />}
                  <span>Save Project</span>
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MILESTONE MODAL */}
      <AnimatePresence>
        {isMilestoneModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2rem] border border-slate-100 w-full max-w-lg overflow-hidden shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-lg font-black text-slate-900">{editingMilestone ? "Edit Milestone" : "New Milestone"}</h3>
                <button onClick={() => setIsMilestoneModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  milestoneMutation.mutate(milestoneForm);
                }}
                className="space-y-4 text-xs font-semibold text-slate-700"
              >
                {!editingMilestone && (
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Project Container</label>
                    <select
                      value={milestoneForm.projectId}
                      onChange={(e) => setMilestoneForm({ ...milestoneForm, projectId: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500 focus:bg-white"
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Milestone Title</label>
                  <input
                    type="text"
                    required
                    value={milestoneForm.title}
                    onChange={(e) => setMilestoneForm({ ...milestoneForm, title: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Description</label>
                  <textarea
                    value={milestoneForm.description}
                    onChange={(e) => setMilestoneForm({ ...milestoneForm, description: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500 focus:bg-white h-20 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Due Date</label>
                    <input
                      type="date"
                      required
                      value={milestoneForm.dueDate}
                      onChange={(e) => setMilestoneForm({ ...milestoneForm, dueDate: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500 focus:bg-white"
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-6">
                    <input
                      type="checkbox"
                      id="isReached"
                      checked={milestoneForm.isReached}
                      onChange={(e) => setMilestoneForm({ ...milestoneForm, isReached: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                    />
                    <label htmlFor="isReached" className="text-slate-650 cursor-pointer">Milestone Reached</label>
                  </div>
                </div>

                <div className="flex gap-2">
                  {editingMilestone && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Delete milestone?")) {
                          deleteMilestoneMutation.mutate(editingMilestone.id);
                          setIsMilestoneModalOpen(false);
                        }
                      }}
                      className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-650 font-bold py-3 rounded-xl transition-all"
                    >
                      Delete
                    </button>
                  )}
                  <button
                    type="submit"
                    className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-md shadow-indigo-600/10"
                  >
                    Save Milestone
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CALENDAR NOTE MODAL */}
      <AnimatePresence>
        {isNoteModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2rem] border border-slate-100 w-full max-w-lg overflow-hidden shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-lg font-black text-slate-900">{editingNote ? "Edit Calendar Note" : "New Calendar Note"}</h3>
                <button onClick={() => setIsNoteModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  noteMutation.mutate(noteForm);
                }}
                className="space-y-4 text-xs font-semibold text-slate-700"
              >
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Note Date</label>
                  <input
                    type="date"
                    required
                    value={noteForm.targetDate}
                    onChange={(e) => setNoteForm({ ...noteForm, targetDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Note Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Daily Standup Notes"
                    value={noteForm.title}
                    onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Content Details</label>
                  <textarea
                    placeholder="Provide standup summary, notes, or blocker descriptions..."
                    value={noteForm.content}
                    onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500 focus:bg-white h-28 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Note Category</label>
                  <div className="grid grid-cols-2 gap-2">
                    {NOTE_CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setNoteForm({ ...noteForm, category: cat.id })}
                        className={cn(
                          "px-3 py-2.5 rounded-xl border text-left flex items-center gap-2 transition-all",
                          noteForm.category === cat.id
                            ? "border-indigo-600 bg-indigo-50/20 font-bold"
                            : "border-slate-200 hover:bg-slate-50"
                        )}
                      >
                        <span className={cn("w-2 h-2 rounded-full", cat.dot)} />
                        <span>{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  {editingNote && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Delete calendar note?")) {
                          deleteNoteMutation.mutate(editingNote.id);
                          setIsNoteModalOpen(false);
                        }
                      }}
                      className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-650 font-bold py-3 rounded-xl transition-all"
                    >
                      Delete
                    </button>
                  )}
                  <button
                    type="submit"
                    className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-md shadow-indigo-600/10"
                  >
                    Save Note
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EXTENDED TASK MODAL */}
      <AnimatePresence>
        {isTaskModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2rem] border border-slate-100 w-full max-w-xl overflow-hidden shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-lg font-black text-slate-900">{editingTask ? "Edit Task Details" : "New Timeline Task"}</h3>
                <button onClick={() => setIsTaskModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  taskMutation.mutate(taskForm);
                }}
                className="space-y-4 text-xs font-semibold text-slate-700"
              >
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Task Title</label>
                  <input
                    type="text"
                    required
                    value={taskForm.title}
                    onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Project Container</label>
                    <select
                      value={taskForm.projectId}
                      onChange={(e) => setTaskForm({ ...taskForm, projectId: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500 focus:bg-white"
                    >
                      <option value="">No Project Container</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Assignee</label>
                    <select
                      value={taskForm.assigneeId}
                      onChange={(e) => setTaskForm({ ...taskForm, assigneeId: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500 focus:bg-white"
                    >
                      <option value="">No Assignee</option>
                      {users.map((u: any) => (
                        <option key={u.id} value={u.id}>{u.fullName || u.username}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Timeline Start Date</label>
                    <input
                      type="date"
                      value={taskForm.startDate}
                      onChange={(e) => setTaskForm({ ...taskForm, startDate: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Due Date</label>
                    <input
                      type="date"
                      value={taskForm.dueDate}
                      onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Priority</label>
                    <select
                      value={taskForm.priority}
                      onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500 focus:bg-white"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Status</label>
                    <select
                      value={taskForm.status}
                      onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500 focus:bg-white"
                    >
                      <option value="NOT_STARTED">Not Started</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="BLOCKED">On Hold</option>
                      <option value="DONE">Done</option>
                    </select>
                  </div>
                </div>

                {/* TASK DEPENDENCIES SELECTION */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Blocked By (Dependencies)</label>
                  <div className="max-h-24 overflow-y-auto border border-slate-200 rounded-xl p-2.5 bg-slate-50 space-y-1">
                    {tasks.filter((t: any) => t.id !== editingTask?.id).map((t: any) => {
                      const isChecked = taskForm.dependencyIds.includes(t.id);
                      return (
                        <div key={t.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`dep-${t.id}`}
                            checked={isChecked}
                            onChange={(e) => {
                              const updated = e.target.checked
                                ? [...taskForm.dependencyIds, t.id]
                                : taskForm.dependencyIds.filter(id => id !== t.id);
                              setTaskForm({ ...taskForm, dependencyIds: updated });
                            }}
                            className="w-3.5 h-3.5 text-indigo-600 border-slate-300 rounded cursor-pointer"
                          />
                          <label htmlFor={`dep-${t.id}`} className="text-slate-650 cursor-pointer text-xs truncate">
                            {t.title}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  {editingTask && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Delete this task?")) {
                          api.delete(`/tasks/${editingTask.id}`).then(() => {
                            queryClient.invalidateQueries({ queryKey: ["tasks"] });
                            queryClient.invalidateQueries({ queryKey: ["pmo-projects"] });
                            setIsTaskModalOpen(false);
                          });
                        }
                      }}
                      className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-650 font-bold py-3 rounded-xl transition-all"
                    >
                      Delete
                    </button>
                  )}
                  <button
                    type="submit"
                    className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-md shadow-indigo-600/10"
                  >
                    Save Task Details
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
