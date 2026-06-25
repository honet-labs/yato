"use client";

import { PageHeader } from "@/components/PageHeader";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { useState, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Play, 
  Check, 
  X, 
  Layers, 
  Clock, 
  ChevronDown, 
  CheckSquare, 
  Sparkles, 
  Folder, 
  Tag, 
  ListTodo, 
  AlertTriangle,
  Loader2,
  CalendarDays
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";

function TaskTemplatesPageContent() {
  const { lang, t } = useLanguage();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  
  // State for Task Templates Editor Modal
  const [isTemplateEditorOpen, setIsTemplateEditorOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState(null as string | null);
  const [templateForm, setTemplateForm] = useState({
    templateName: "",
    title: "",
    description: "",
    priority: "MEDIUM",
    taskType: "TASK",
    checklist: [] as any[],
    repeatInterval: "NONE",
    repeatTime: "09:00",
    repeatDayOfWeek: 1,
    repeatDayOfMonth: 1,
    tags: [] as string[],
    projectIds: [] as string[]
  });
  const [templateTagInput, setTemplateTagInput] = useState("");

  // Queries
  const { data: templates, isLoading: isLoadingTemplates } = useQuery({
    queryKey: ["task-templates"],
    queryFn: async () => {
      const res = await api.get("/tasks/templates");
      return res.data;
    }
  });

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const res = await api.get("/pmo/projects");
      return res.data;
    }
  });

  const { data: tasks } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const res = await api.get("/tasks");
      return res.data;
    }
  });

  const { data: catalogTaskTypes } = useQuery({
    queryKey: ["catalog", "TASK_TYPE"],
    queryFn: async () => {
      const response = await api.get("/catalog?category=TASK_TYPE");
      return response.data;
    },
  });

  const TASK_TYPES = catalogTaskTypes && catalogTaskTypes.length > 0
    ? catalogTaskTypes.map((c: any) => c.value)
    : ["TASK", "TROUBLESHOOT", "UPDATE", "BACKUP"];

  const uniqueTags = Array.from(new Set(tasks?.flatMap((t: any) => t.tags || []) || [])) as string[];

  // Mutations
  const createTemplateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post("/tasks/templates", payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-templates"] });
      setIsTemplateEditorOpen(false);
      queryClient.setQueryData(["toast"], { message: "Template blueprint created successfully!", type: "success" });
    },
    onError: (error: any) => {
      const errMsg = error.response?.data?.message || "Failed to create template blueprint";
      queryClient.setQueryData(["toast"], { message: errMsg, type: "error" });
    }
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const res = await api.patch(`/tasks/templates/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-templates"] });
      setIsTemplateEditorOpen(false);
      queryClient.setQueryData(["toast"], { message: "Template blueprint updated successfully!", type: "success" });
    },
    onError: (error: any) => {
      const errMsg = error.response?.data?.message || "Failed to update template blueprint";
      queryClient.setQueryData(["toast"], { message: errMsg, type: "error" });
    }
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/tasks/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-templates"] });
      queryClient.setQueryData(["toast"], { message: "Template blueprint deleted successfully!", type: "success" });
    }
  });

  // Use Template Mutation (manually generates a task from the template)
  const useTemplateMutation = useMutation({
    mutationFn: async (template: any) => {
      const targetProjects = template.projects && template.projects.length > 0
        ? template.projects
        : [null];

      const results = [];
      for (const proj of targetProjects) {
        const payload = {
          title: template.title || "New Task from Template",
          description: template.description || "",
          status: "NOT_STARTED",
          priority: template.priority || "MEDIUM",
          taskType: template.taskType || "TASK",
          checklist: template.checklist || [],
          templateId: template.id,
          tags: template.tags || [],
          projectId: proj ? proj.id : undefined
        };
        const res = await api.post("/tasks", payload);
        results.push(res.data);
      }
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.setQueryData(["toast"], { message: "Tasks successfully generated from template!", type: "success" });
    }
  });

  // Action Handlers
  const handleCreateTemplateStart = () => {
    setEditingTemplateId(null);
    setTemplateForm({
      templateName: "",
      title: "",
      description: "",
      priority: "MEDIUM",
      taskType: "TASK",
      checklist: [],
      repeatInterval: "NONE",
      repeatTime: "09:00",
      repeatDayOfWeek: 1,
      repeatDayOfMonth: 1,
      tags: [],
      projectIds: []
    });
    setTemplateTagInput("");
    setIsTemplateEditorOpen(true);
  };

  const handleEditTemplateStart = (template: any) => {
    setEditingTemplateId(template.id);
    setTemplateForm({
      templateName: template.templateName || "",
      title: template.title || "",
      description: template.description || "",
      priority: template.priority || "MEDIUM",
      taskType: template.taskType || "TASK",
      checklist: template.checklist || [],
      repeatInterval: template.repeatInterval || "NONE",
      repeatTime: template.repeatTime || "09:00",
      repeatDayOfWeek: template.repeatDayOfWeek || 1,
      repeatDayOfMonth: template.repeatDayOfMonth || 1,
      tags: template.tags || [],
      projectIds: template.projects?.map((p: any) => p.id) || []
    });
    setTemplateTagInput("");
    setIsTemplateEditorOpen(true);
  };

  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateForm.templateName.trim()) {
      queryClient.setQueryData(["toast"], {
        message: lang === "ID" ? "Nama templat tidak boleh kosong!" : "Template name cannot be empty!",
        type: "error"
      });
      return;
    }
    if (!templateForm.title.trim()) {
      queryClient.setQueryData(["toast"], {
        message: lang === "ID" ? "Judul tugas default tidak boleh kosong!" : "Default task title blueprint cannot be empty!",
        type: "error"
      });
      return;
    }

    const payload = {
      ...templateForm,
    };

    if (editingTemplateId) {
      updateTemplateMutation.mutate({ id: editingTemplateId, payload });
    } else {
      createTemplateMutation.mutate(payload);
    }
  };

  const filteredTemplates = templates?.filter((t: any) => {
    const matchesSearch = 
      t.templateName?.toLowerCase().includes(search.toLowerCase()) ||
      t.title?.toLowerCase().includes(search.toLowerCase()) ||
      t.description?.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  }) || [];

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        <MobileNav />
        <main className="page-container overflow-y-auto custom-scrollbar p-8 flex-1">
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <PageHeader 
              title={t("Task Templates")} 
              subtitle={lang === "ID" ? "Kelola templat tugas cetak biru dan konfigurasi pengulangan otomatis" : "Manage task blueprint templates and auto-recurring scheduling configurations"} 
            />
            <button
              onClick={handleCreateTemplateStart}
              className="btn-primary flex items-center gap-2 self-start md:self-auto py-2.5 px-4 rounded-xl shadow-lg hover:shadow-xl active:scale-95 transition-all text-xs font-bold uppercase tracking-wider shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>{lang === "ID" ? "Buat Templat" : "Create Template"}</span>
            </button>
          </header>

          {/* Search Bar */}
          <div className="relative group max-w-md mb-8">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
            <input 
              type="text" 
              className="bg-white border border-slate-200 rounded-xl pl-11 pr-4 py-2.5 text-sm w-full focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all shadow-sm" 
              placeholder={lang === "ID" ? "Cari templat tugas..." : "Search blueprint templates..."} 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Main Grid List */}
          {isLoadingTemplates ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{lang === "ID" ? "Memuat templat..." : "Loading templates..."}</p>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="glass-card flex flex-col items-center justify-center text-center p-12 max-w-lg mx-auto mt-12 border border-dashed border-slate-200">
              <div className="w-16 h-16 rounded-3xl bg-blue-50/50 border border-blue-100 flex items-center justify-center mb-4">
                <Layers className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="font-extrabold text-slate-900 mb-1 text-sm tracking-tight">
                {lang === "ID" ? "Belum Ada Templat" : "No Templates Found"}
              </h3>
              <p className="text-[12px] text-slate-500 max-w-xs leading-relaxed mb-6">
                {lang === "ID" 
                  ? "Buat cetak biru tugas untuk menghasilkan tugas secara berkala atau satu kali klik dengan cepat."
                  : "Create task blueprint templates to automatically recur or spawn identical task structures in one-click."}
              </p>
              <button
                onClick={handleCreateTemplateStart}
                className="btn-primary py-2 px-4 rounded-xl text-xs font-bold"
              >
                {lang === "ID" ? "Mulai Buat Templat" : "Get Started"}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTemplates.map((template: any) => {
                const hasProjects = template.projects && template.projects.length > 0;
                return (
                  <motion.div 
                    layout
                    key={template.id} 
                    className="glass-card flex flex-col overflow-hidden hover:shadow-xl transition-all border border-slate-200/60 p-0 relative"
                  >
                    {/* Ribbon header badge */}
                    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 flex items-center justify-between text-amber-900 rounded-t-2xl">
                      <span className="text-[11px] font-black uppercase tracking-wider truncate max-w-[200px]" title={template.templateName}>
                        {template.templateName}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[8px] font-bold tracking-widest uppercase",
                          template.priority === "HIGH" && "bg-rose-500/10 text-rose-700",
                          template.priority === "MEDIUM" && "bg-amber-500/10 text-amber-700",
                          template.priority === "LOW" && "bg-emerald-500/10 text-emerald-700"
                        )}>
                          {template.priority}
                        </span>
                        <span className="bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded text-[8px] font-bold tracking-widest uppercase">
                          {template.taskType}
                        </span>
                      </div>
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      {/* Body */}
                      <div className="space-y-2.5">
                        <h3 className="font-bold text-sm text-slate-900 tracking-tight leading-snug line-clamp-2" title={template.title}>
                          {template.title}
                        </h3>
                        {template.description && (
                          <p className="text-[12px] text-slate-500 line-clamp-3 leading-relaxed">
                            {template.description}
                          </p>
                        )}

                        {/* Repeat configurations info */}
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-bold bg-slate-50 border border-slate-100 rounded-xl p-2.5">
                          <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span className="truncate">
                            {template.repeatInterval === "NONE" && (lang === "ID" ? "Tidak berulang otomatis" : "Manual trigger only")}
                            {template.repeatInterval === "DAILY" && `Setiap hari jam ${template.repeatTime}`}
                            {template.repeatInterval === "WEEKLY" && `Setiap minggu Hari ke-${template.repeatDayOfWeek} jam ${template.repeatTime}`}
                            {template.repeatInterval === "MONTHLY" && `Setiap tanggal ${template.repeatDayOfMonth} jam ${template.repeatTime}`}
                          </span>
                        </div>

                        {/* Checklist & Tags summary */}
                        <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                          {template.checklist && template.checklist.length > 0 && (
                            <span className="flex items-center gap-1">
                              <CheckSquare className="w-3.5 h-3.5 text-slate-400" />
                              {template.checklist.length} checklist items
                            </span>
                          )}
                          {template.tags && template.tags.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Tag className="w-3 h-3 text-slate-400" />
                              {template.tags.length} tags
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Workspaces */}
                      <div className="space-y-1.5 pt-3 border-t border-slate-100">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                          {lang === "ID" ? "Tujuan Tracker Workspace" : "Destination Tracker Workspace"}
                        </span>
                        {hasProjects ? (
                          <div className="flex flex-wrap gap-1">
                            {template.projects.map((proj: any) => (
                              <span 
                                key={proj.id}
                                className="px-2 py-0.5 rounded-lg text-[10px] font-bold border flex items-center gap-1"
                                style={{
                                  backgroundColor: `${proj.colorCode}15`,
                                  color: proj.colorCode,
                                  borderColor: `${proj.colorCode}30`
                                }}
                              >
                                <span className="w-1 h-1 rounded-full" style={{ backgroundColor: proj.colorCode }} />
                                {proj.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-bold uppercase italic">
                            {lang === "ID" ? "Semua Project (Global)" : "All / Global (unassigned)"}
                          </span>
                        )}
                      </div>

                      {/* Card Footer Actions */}
                      <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                        <button
                          onClick={() => handleEditTemplateStart(template)}
                          className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
                          title="Edit Template Blueprint"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(lang === "ID" ? "Hapus templat ini?" : "Permanently delete this template?")) {
                              deleteTemplateMutation.mutate(template.id);
                            }
                          }}
                          className="p-2 hover:bg-red-50 rounded-xl text-slate-400 hover:text-red-600 transition-all cursor-pointer"
                          title="Delete Template Blueprint"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        
                        <div className="flex-1" />
                        
                        <button
                          onClick={() => useTemplateMutation.mutate(template)}
                          disabled={useTemplateMutation.isPending}
                          className="btn-primary !py-1.5 !px-3 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-all shadow-sm hover:shadow-md"
                        >
                          {useTemplateMutation.isPending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Play className="w-3.5 h-3.5 fill-current" />
                          )}
                          <span>{lang === "ID" ? "Gunakan Templat" : "Spawn Task"}</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* ==================== TASK TEMPLATE EDITOR MODAL ==================== */}
          <AnimatePresence>
            {isTemplateEditorOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-sm">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-2xl w-full max-w-lg border border-slate-100 shadow-2xl flex flex-col max-h-[90vh]"
                >
                  <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-3 flex flex-wrap items-center justify-between text-amber-800 gap-3 rounded-t-2xl relative overflow-visible">
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <span className="animate-pulse w-2 h-2 bg-amber-500 rounded-full" />
                      <span>{editingTemplateId ? (lang === "ID" ? "Mengedit templat:" : "Editing blueprint:") : (lang === "ID" ? "Membuat templat:" : "Creating blueprint:")}</span>
                      <span className="bg-amber-500/20 text-amber-900 px-2.5 py-1 rounded-lg flex items-center gap-1 border border-amber-500/20">
                        <Check className="w-3.5 h-3.5 text-amber-700 stroke-[3]" />
                        <input 
                          type="text"
                          required
                          form="template-editor-form"
                          value={templateForm.templateName}
                          onChange={(e) => setTemplateForm(prev => ({ ...prev, templateName: e.target.value }))}
                          className="bg-transparent border-none focus:outline-none focus:ring-0 p-0 text-xs font-black text-amber-900 w-36 outline-none"
                          placeholder="Template Name..."
                        />
                      </span>
                    </div>
                    
                    {/* Repeat configuration */}
                    <div className="flex items-center gap-1 text-[11px] font-bold">
                      <div className="relative group/repeat">
                        <button 
                          type="button" 
                          className="bg-white border border-amber-200 hover:bg-amber-50 text-amber-900 px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                        >
                          <span className="text-[10px]">
                            {templateForm.repeatInterval === "NONE" && "Don't repeat"}
                            {templateForm.repeatInterval === "DAILY" && "Repeat: Daily"}
                            {templateForm.repeatInterval === "WEEKLY" && "Repeat: Weekly"}
                            {templateForm.repeatInterval === "MONTHLY" && "Repeat: Monthly"}
                          </span>
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <div className="absolute left-0 top-full mt-1.5 w-40 bg-white border border-slate-200 rounded-xl shadow-xl p-1 z-[110] opacity-0 pointer-events-none group-focus-within/repeat:opacity-100 group-focus-within/repeat:pointer-events-auto transition-all">
                          {[
                            { id: "NONE", label: "Don't repeat" },
                            { id: "DAILY", label: "Daily" },
                            { id: "WEEKLY", label: "Weekly" },
                            { id: "MONTHLY", label: "Monthly" }
                          ].map(opt => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setTemplateForm(prev => ({ ...prev, repeatInterval: opt.id }))}
                              className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 rounded-lg text-[10px] font-bold text-slate-700 flex items-center justify-between cursor-pointer"
                            >
                              <span>{opt.label}</span>
                              {templateForm.repeatInterval === opt.id && <Check className="w-3.5 h-3.5 text-blue-600" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <form id="template-editor-form" onSubmit={handleSaveTemplate} className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Default Task Title Blueprint</label>
                      <input 
                        type="text" 
                        required
                        placeholder="e.g. Daily server backup review"
                        value={templateForm.title}
                        onChange={(e) => setTemplateForm(prev => ({ ...prev, title: e.target.value }))}
                        className="input-field w-full bg-white"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Default Description</label>
                      <textarea 
                        placeholder="Enter the template's default description here..."
                        value={templateForm.description}
                        onChange={(e) => setTemplateForm(prev => ({ ...prev, description: e.target.value }))}
                        className="input-field w-full min-h-[80px] bg-white resize-none font-medium"
                      />
                    </div>

                    {/* Scheduled Repeat Details */}
                    {templateForm.repeatInterval !== "NONE" && (
                      <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3.5 space-y-3">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-blue-500" />
                          <span>Precision Scheduling Settings</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3.5">
                          {templateForm.repeatInterval === "WEEKLY" && (
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Repeat Day of Week</label>
                              <div className="relative">
                                <select
                                  value={templateForm.repeatDayOfWeek || 1}
                                  onChange={(e) => setTemplateForm(prev => ({ ...prev, repeatDayOfWeek: Number(e.target.value) }))}
                                  className="input-field pr-10 w-full appearance-none bg-white !py-1.5 text-xs font-bold cursor-pointer"
                                >
                                  <option value={1}>Monday</option>
                                  <option value={2}>Tuesday</option>
                                  <option value={3}>Wednesday</option>
                                  <option value={4}>Thursday</option>
                                  <option value={5}>Friday</option>
                                  <option value={6}>Saturday</option>
                                  <option value={7}>Sunday</option>
                                </select>
                                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                              </div>
                            </div>
                          )}

                          {templateForm.repeatInterval === "MONTHLY" && (
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Repeat Day of Month</label>
                              <div className="relative">
                                <select
                                  value={templateForm.repeatDayOfMonth || 1}
                                  onChange={(e) => setTemplateForm(prev => ({ ...prev, repeatDayOfMonth: Number(e.target.value) }))}
                                  className="input-field pr-10 w-full appearance-none bg-white !py-1.5 text-xs font-bold cursor-pointer"
                                >
                                  {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                                    <option key={day} value={day}>{day}{day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'} of month</option>
                                  ))}
                                </select>
                                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                              </div>
                            </div>
                          )}

                          <div className="space-y-1 col-span-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Target Repeat Time</label>
                            <input 
                              type="time"
                              value={templateForm.repeatTime || "09:00"}
                              onChange={(e) => setTemplateForm(prev => ({ ...prev, repeatTime: e.target.value }))}
                              className="input-field w-full bg-white !py-1 text-xs font-bold text-center"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Default Priority</label>
                        <div className="relative">
                          <select 
                            value={templateForm.priority}
                            onChange={(e) => setTemplateForm(prev => ({ ...prev, priority: e.target.value }))}
                            className="input-field pr-10 w-full bg-white cursor-pointer appearance-none"
                          >
                            <option value="LOW">Low</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="HIGH">High</option>
                          </select>
                          <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Default Task Type</label>
                        <div className="relative">
                          <select 
                            value={templateForm.taskType}
                            onChange={(e) => setTemplateForm(prev => ({ ...prev, taskType: e.target.value }))}
                            className="input-field pr-10 w-full bg-white cursor-pointer appearance-none"
                          >
                            {TASK_TYPES.map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Destination Task Tracker Workspaces</label>
                      <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                        <button
                          type="button"
                          onClick={() => {
                            setTemplateForm(prev => ({ ...prev, projectIds: [] }));
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                            templateForm.projectIds.length === 0
                              ? "bg-slate-900 border-slate-950 text-white shadow-sm"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100/50"
                          }`}
                        >
                          Global (unassigned)
                        </button>

                        {projects?.map((proj: any) => {
                          const isSelected = templateForm.projectIds.includes(proj.id);
                          return (
                            <button
                              key={proj.id}
                              type="button"
                              onClick={() => {
                                setTemplateForm(prev => {
                                  const exist = prev.projectIds.includes(proj.id);
                                  const newIds = exist
                                    ? prev.projectIds.filter(id => id !== proj.id)
                                    : [...prev.projectIds, proj.id];
                                  return { ...prev, projectIds: newIds };
                                });
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5"
                              style={{
                                backgroundColor: isSelected ? `${proj.colorCode}15` : '#ffffff',
                                color: isSelected ? proj.colorCode : '#475569',
                                borderColor: isSelected ? proj.colorCode : '#e2e8f0',
                              }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: proj.colorCode }} />
                              <span>{proj.name}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Tags blueprint section */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-50">
                      <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Default Tags Blueprint</label>
                      <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200/80 rounded-xl min-h-[42px] items-center">
                        {templateForm.tags?.map((tag) => (
                          <span key={tag} className="bg-white text-slate-600 border border-slate-200 px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 shadow-sm">
                            #{tag}
                            <button
                              type="button"
                              onClick={() => setTemplateForm(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }))}
                              className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                        <input
                          type="text"
                          placeholder={(!templateForm.tags || templateForm.tags.length === 0) ? "Type tag and press Enter..." : ""}
                          value={templateTagInput}
                          onChange={(e) => setTemplateTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ',') {
                              e.preventDefault();
                              const val = templateTagInput.trim().replace(/,/g, '');
                              if (val && !templateForm.tags?.includes(val)) {
                                setTemplateForm(prev => ({ ...prev, tags: [...(prev.tags || []), val] }));
                              }
                              setTemplateTagInput("");
                            }
                          }}
                          className="bg-transparent border-none focus:outline-none focus:ring-0 p-0 text-xs font-bold text-slate-700 placeholder-slate-400 flex-1 outline-none min-w-[120px]"
                        />
                      </div>
                      {uniqueTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 items-center pt-1">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mr-1">Suggestions:</span>
                          {uniqueTags.filter(t => !templateForm.tags?.includes(t)).slice(0, 5).map(tag => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => setTemplateForm(prev => ({ ...prev, tags: [...(prev.tags || []), tag] }))}
                              className="bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700 px-2 py-1 rounded text-[11px] font-bold border border-slate-200/50 transition-all cursor-pointer"
                            >
                              +{tag}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Checklist blueprint section */}
                    <div className="space-y-2 pt-2 border-t border-slate-50">
                      <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Default Checklist Blueprint</label>
                      <div className="space-y-2">
                        {templateForm.checklist.map((item, idx) => (
                          <div key={item.id || idx} className="flex items-center gap-2.5 bg-slate-50/70 border border-slate-100 p-2.5 rounded-xl transition-all">
                            <div className="w-4 h-4 border border-slate-300 rounded" />
                            <input 
                              type="text"
                              value={item.text}
                              placeholder="Type checklist item..."
                              onChange={(e) => {
                                const newCl = [...templateForm.checklist];
                                newCl[idx].text = e.target.value;
                                setTemplateForm(prev => ({ ...prev, checklist: newCl }));
                              }}
                              className="flex-1 bg-transparent text-[11px] font-bold focus:outline-none border-none p-0 focus:ring-0 text-slate-700"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newCl = templateForm.checklist.filter((_, i) => i !== idx);
                                setTemplateForm(prev => ({ ...prev, checklist: newCl }));
                              }}
                              className="text-slate-400 hover:text-red-500 transition-colors p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            setTemplateForm(prev => ({
                              ...prev,
                              checklist: [...prev.checklist, { id: Math.random().toString(), text: "", isDone: false }]
                            }));
                          }}
                          className="w-full text-left p-2.5 bg-slate-50/30 hover:bg-slate-50 border border-dashed border-slate-200 rounded-xl text-[10px] font-bold text-slate-500 hover:text-slate-800 transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add checklist item blueprint
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-50">
                      <button 
                        type="button" 
                        onClick={() => setIsTemplateEditorOpen(false)}
                        className="btn-secondary"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit" 
                        className="btn-primary bg-amber-500 border-amber-600 hover:bg-amber-600 focus:ring-amber-500/20 text-white"
                      >
                        {editingTemplateId ? "Save Blueprint Changes" : "Create Template Blueprint"}
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export default function TaskTemplatesPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-slate-50 font-sans">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading task templates...</p>
        </div>
      </div>
    }>
      <TaskTemplatesPageContent />
    </Suspense>
  );
}
