"use client";
import { PageHeader } from "@/components/PageHeader";

import { useState, useEffect, useRef, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { Footer } from "@/components/Footer";
import api from "@/lib/api";
import { useSearchParams, useRouter } from "next/navigation";
import { 
  Plus, 
  Search, 
  CheckSquare, 
  MessageSquare, 
  Calendar, 
  AlertCircle, 
  Trash2, 
  X, 
  Loader2, 
  ArrowRight, 
  Sparkles, 
  Grid, 
  List, 
  CheckCircle2, 
  Clock, 
  ChevronRight,
  User,
  Tag,
  ChevronDown,
  Maximize2,
  Minimize2,
  Paperclip,
  Check,
  CornerDownRight,
  Share2,
  Link2,
  UserPlus,
  Edit,
  Download
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// Status definitions and styling configurations - aligned with standard project tags
const STATUSES = [
  { id: "NOT_STARTED", label: "Not started", color: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-400" },
  { id: "IN_PROGRESS", label: "In progress", color: "bg-blue-50 text-blue-700 border-blue-100", dot: "bg-blue-500" },
  { id: "BLOCKED", label: "On Hold", color: "bg-amber-50 text-amber-700 border-amber-100", dot: "bg-amber-500" },
  { id: "DONE", label: "Done", color: "bg-emerald-50 text-emerald-700 border-emerald-100", dot: "bg-emerald-500" }
];

const PRIORITIES = [
  { id: "LOW", label: "Low", color: "bg-slate-50 text-slate-600 border-slate-100" },
  { id: "MEDIUM", label: "Medium", color: "bg-amber-50 text-amber-600 border-amber-100" },
  { id: "HIGH", label: "High", color: "bg-rose-50 text-rose-600 border-rose-100" }
];

const TaskTreeRow = ({
  task,
  depth = 0,
  STATUSES,
  PRIORITIES,
  expandedTaskIds,
  setExpandedTaskIds,
  filteredTasks,
  setSelectedTask,
  handleCheckboxToggle,
  getSubtasksOf,
  taskOrDescendantMatches
}: {
  task: any;
  depth?: number;
  STATUSES: any[];
  PRIORITIES: any[];
  expandedTaskIds: any;
  setExpandedTaskIds: any;
  filteredTasks: any[];
  setSelectedTask: (task: any) => void;
  handleCheckboxToggle: (task: any, e: any) => void;
  getSubtasksOf: (taskId: string) => any[];
  taskOrDescendantMatches: (task: any) => boolean;
}) => {
  const statusObj = STATUSES.find(s => s.id === task.status);
  const priorityObj = PRIORITIES.find(p => p.id === task.priority);
  const subtasks = getSubtasksOf(task.id);
  const hasChildren = subtasks.length > 0;
  const isExpanded = !!expandedTaskIds[task.id];
  const matchesFilters = filteredTasks.some((ft: any) => ft.id === task.id);

  return (
    <div key={task.id} className="w-full">
      {/* Task Row */}
      <div 
        onClick={() => setSelectedTask(task)}
        className={cn(
          "px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 cursor-pointer transition-all gap-4 border-b border-slate-100/60",
          !matchesFilters && "opacity-60 bg-slate-50/20"
        )}
        style={{ paddingLeft: `${depth * 24 + 24}px` }}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Expand / Collapse Toggle if has subtasks */}
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpandedTaskIds(prev => ({ ...prev, [task.id]: !prev[task.id] }));
              }}
              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-all shrink-0"
            >
              <ChevronRight className={cn("w-4.5 h-4.5 transition-transform duration-205", isExpanded && "rotate-90")} />
            </button>
          ) : (
            <div className="w-6.5 h-6.5 shrink-0 flex items-center justify-center">
              {depth > 0 ? <CornerDownRight className="w-3.5 h-3.5 text-slate-350" /> : null}
            </div>
          )}

          <button
            onClick={(e) => handleCheckboxToggle(task, e)}
            className="shrink-0 transition-transform active:scale-95"
          >
            {task.status === "DONE" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-50" />
            ) : (
              <CheckSquare className="w-5 h-5 text-slate-200 hover:text-blue-500" />
            )}
          </button>

          <div className="min-w-0">
            <h4 className={cn("text-[12px] font-bold text-slate-800 truncate max-w-lg mb-0", task.status === "DONE" && "line-through text-slate-400")}>
              {task.title}
            </h4>
            {task.description && (
              <p className="text-[10px] text-slate-400 font-medium truncate max-w-lg mt-0.5">
                {task.description}
              </p>
            )}
            {task.tags && task.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {task.tags.map((tag: string) => (
                  <span key={tag} className="bg-slate-50 text-slate-500 border border-slate-200/50 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {/* Task Type */}
          <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tight">
            {task.taskType}
          </span>

          {/* Priority */}
          {priorityObj && (
            <span className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tight border", priorityObj.color)}>
              {priorityObj.label}
            </span>
          )}

          {/* Status */}
          {statusObj && (
            <span className={cn("px-2.5 py-1 rounded-lg text-[8px] font-extrabold uppercase border tracking-widest flex items-center gap-1", statusObj.color)}>
              <span className={cn("w-1 h-1 rounded-full", statusObj.dot)} /> {statusObj.label}
            </span>
          )}

          {/* Due Date */}
          {task.dueDate && (
            <div className="flex items-center gap-1 text-slate-400 text-[10px] font-bold">
              <Calendar className="w-3.5 h-3.5" />
              <span>{new Date(task.dueDate).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Render child tasks if expanded */}
      {hasChildren && isExpanded && (
        <div className="w-full">
          {subtasks.filter(taskOrDescendantMatches).map(child => (
            <TaskTreeRow
              key={child.id}
              task={child}
              depth={depth + 1}
              STATUSES={STATUSES}
              PRIORITIES={PRIORITIES}
              expandedTaskIds={expandedTaskIds}
              setExpandedTaskIds={setExpandedTaskIds}
              filteredTasks={filteredTasks}
              setSelectedTask={setSelectedTask}
              handleCheckboxToggle={handleCheckboxToggle}
              getSubtasksOf={getSubtasksOf}
              taskOrDescendantMatches={taskOrDescendantMatches}
            />
          ))}
        </div>
      )}
    </div>
  );
};

function TasksPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const taskIdParam = searchParams.get("taskId");
  const projectIdParam = searchParams.get("projectId");
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("board" as "board" | "list");
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [tagFilter, setTagFilter] = useState("ALL");

  // Project / Sub-tracker States & Mutations
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [newProjectColor, setNewProjectColor] = useState("#4F46E5");

  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState(null as string | null);
  const [editProjectName, setEditProjectName] = useState("");
  const [editProjectDesc, setEditProjectDesc] = useState("");
  const [editProjectColor, setEditProjectColor] = useState("#4F46E5");

  const { data: projects, isLoading: isLoadingProjects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const res = await api.get("/pmo/projects");
      return res.data;
    }
  });

  const activeProject = projects?.find((p: any) => p.id === projectIdParam) || null;

  const createProjectMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post("/pmo/projects", payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setIsCreateProjectOpen(false);
      setNewProjectName("");
      setNewProjectDesc("");
      setNewProjectColor("#4F46E5");
      // Open the new project tracker immediately
      router.push(`/tasks?projectId=${data.id}`);
    }
  });

  const updateProjectMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const res = await api.patch(`/pmo/projects/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setIsEditProjectOpen(false);
      setEditingProjectId(null);
    }
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/pmo/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      if (projectIdParam) {
        router.push("/tasks");
      }
    }
  });

  const handleCreateProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    createProjectMutation.mutate({
      name: newProjectName,
      description: newProjectDesc,
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      status: "ACTIVE",
      colorCode: newProjectColor
    });
  };

  const handleUpdateProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProjectId || !editProjectName.trim()) return;
    updateProjectMutation.mutate({
      id: editingProjectId,
      payload: {
        name: editProjectName,
        description: editProjectDesc,
        colorCode: editProjectColor
      }
    });
  };

  const handleDeleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this tracker? Tasks associated with this tracker will no longer have a tracker assigned.")) {
      deleteProjectMutation.mutate(id);
    }
  };
  
  // Fetch dynamic task types from settings catalog
  const { data: catalogTaskTypes } = useQuery({
    queryKey: ["catalog", "TASK_TYPE"],
    queryFn: async () => {
      const res = await api.get("/catalog?category=TASK_TYPE");
      return res.data;
    }
  });

  const TASK_TYPES = catalogTaskTypes && catalogTaskTypes.length > 0
    ? catalogTaskTypes.map(c => c.value)
    : ["TASK", "TROUBLESHOOT", "UPDATE", "BACKUP"];

  // State for Task Templates
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
    tags: [] as string[]
  });

  // State for Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [preselectedStatus, setPreselectedStatus] = useState("NOT_STARTED");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("MEDIUM");
  const [newTaskType, setNewTaskType] = useState("TASK");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskAssignees, setNewTaskAssignees] = useState([] as string[]);
  const [newTaskTags, setNewTaskTags] = useState([] as string[]);
  const [newTagInput, setNewTagInput] = useState("");
  const [templateTagInput, setTemplateTagInput] = useState("");
  const [newTaskParentId, setNewTaskParentId] = useState("");

  // State for Task Detail Side-Drawer
  const [selectedTask, setSelectedTask] = useState(null as any | null);
  const [detailTitle, setDetailTitle] = useState("");
  const [detailDesc, setNewDetailDesc] = useState("");
  const [detailStatus, setDetailStatus] = useState("");
  const [detailPriority, setDetailPriority] = useState("");
  const [detailType, setDetailType] = useState("");
  const [detailDueDate, setDetailDueDate] = useState("");
  const [detailAssignee, setDetailAssignee] = useState("");
  const [detailParentId, setDetailParentId] = useState("");
  const [newCommentText, setNewCommentText] = useState("");

  // New Features States
  const [drawerWidth, setDrawerWidth] = useState("normal" as "normal" | "wide" | "full");
  const [replyToId, setReplyToId] = useState(null as string | null);
  const [replyToUser, setReplyToUser] = useState(null as string | null);
  const [copyNotification, setCopyNotification] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [commentAttachments, setCommentAttachments] = useState([] as { filename: string; base64Data: string }[]);

  const [isAssigneePanelOpen, setIsAssigneePanelOpen] = useState(false);
  const [isFollowerPanelOpen, setIsFollowerPanelOpen] = useState(false);
  const [isTagPanelOpen, setIsTagPanelOpen] = useState(false);

  const [previewImage, setPreviewImage] = useState(null as string | null);
  const [loadedTaskId, setLoadedTaskId] = useState(null as string | null);
  const [detailChecklist, setDetailChecklist] = useState([] as any[]);
  const [expandedTaskIds, setExpandedTaskIds] = useState({} as Record<string, boolean>);

  const isImageFile = (filename: string, mimeType?: string) => {
    if (mimeType && mimeType.toLowerCase().startsWith('image/')) return true;
    const ext = filename.split('.').pop()?.toLowerCase();
    return ext ? ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext) : false;
  };

  const getFileUrl = (file: { id: string; driver: string; path?: string }) => {
    if (file.driver === "DATABASE" && file.path) {
      return file.path;
    }
    return `/api/storage/download/${file.id}`;
  };

  // Premium Mentions States
  const textareaRef = useRef(null as HTMLTextAreaElement | null);
  const [mentionSearch, setMentionSearch] = useState("");
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);

  const handleCommentChange = (text: string, selectionStart: number) => {
    setNewCommentText(text);

    const textBeforeCursor = text.substring(0, selectionStart);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      const hasSpace = /\s/.test(textAfterAt);
      const isAtWordStart = lastAtIndex === 0 || /\s/.test(textBeforeCursor.charAt(lastAtIndex - 1));

      if (!hasSpace && isAtWordStart) {
        setShowMentionDropdown(true);
        setMentionSearch(textAfterAt.toLowerCase());
        setMentionStartIndex(lastAtIndex);
        setActiveMentionIndex(0);
        return;
      }
    }

    setShowMentionDropdown(false);
    setMentionStartIndex(-1);
  };

  const insertMention = (user: any) => {
    const tagText = user.username ? `@${user.username}` : `@${user.fullName.replace(/\s+/g, '')}`;
    
    const beforeMention = newCommentText.substring(0, mentionStartIndex);
    const afterMention = newCommentText.substring(mentionStartIndex + mentionSearch.length + 1);
    
    const newText = beforeMention + tagText + " " + afterMention;
    setNewCommentText(newText);
    setShowMentionDropdown(false);
    
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const cursorPosition = mentionStartIndex + tagText.length + 1;
        textareaRef.current.setSelectionRange(cursorPosition, cursorPosition);
      }
    }, 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showMentionDropdown || filteredMentionUsers.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveMentionIndex((prev) => (prev + 1) % filteredMentionUsers.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveMentionIndex((prev) => (prev - 1 + filteredMentionUsers.length) % filteredMentionUsers.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insertMention(filteredMentionUsers[activeMentionIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setShowMentionDropdown(false);
    }
  };

  // Drag and Drop States
  const [activeDragId, setActiveDragId] = useState(null as string | null);
  const [draggedOverColumn, setDraggedOverColumn] = useState(null as string | null);

  // Fetch all tasks
  const { data: tasks, isLoading: isLoadingTasks } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const res = await api.get("/tasks");
      return res.data;
    }
  });

  // Fetch all templates
  const { data: templates } = useQuery({
    queryKey: ["task-templates"],
    queryFn: async () => {
      const res = await api.get("/tasks/templates");
      return res.data;
    }
  });

  // Create Template Mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post("/tasks/templates", payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-templates"] });
      setIsTemplateEditorOpen(false);
    }
  });

  // Update Template Mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const res = await api.patch(`/tasks/templates/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-templates"] });
      setIsTemplateEditorOpen(false);
    }
  });

  // Delete Template Mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/tasks/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-templates"] });
    }
  });

  // Use Template Mutation (creates a task from a template)
  const useTemplateMutation = useMutation({
    mutationFn: async (template: any) => {
      const payload = {
        title: template.title || "New Task from Template",
        description: template.description || "",
        status: "NOT_STARTED",
        priority: template.priority || "MEDIUM",
        taskType: template.taskType || "TASK",
        checklist: template.checklist || [],
        templateId: template.id,
        tags: template.tags || [],
        projectId: projectIdParam || undefined
      };
      const res = await api.post("/tasks", payload);
      return res.data;
    },
    onSuccess: (newTask) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setSelectedTask(newTask); // Open detail drawer automatically!
    }
  });

  // Fetch all users for Assignee list
  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await api.get("/users");
      return res.data;
    }
  });

  // Fetch single task details (including comments) when selected
  const { data: taskDetail, refetch: refetchDetail } = useQuery({
    queryKey: ["task-detail", selectedTask?.id],
    queryFn: async () => {
      if (!selectedTask?.id) return null;
      const res = await api.get(`/tasks/${selectedTask.id}`);
      return res.data;
    },
    enabled: !!selectedTask?.id
  });

  const filteredMentionUsers = users?.filter((u: any) => {
    const searchStr = mentionSearch.toLowerCase();
    const fullNameMatches = u.fullName?.toLowerCase().includes(searchStr);
    const usernameMatches = u.username?.toLowerCase().includes(searchStr);
    return fullNameMatches || usernameMatches;
  }) || [];

  // Deep-Link query param parser effect
  useEffect(() => {
    if (taskIdParam && tasks) {
      const matchingTask = tasks.find((t: any) => t.id === taskIdParam);
      if (matchingTask) {
        setSelectedTask(matchingTask);
      }
    }
  }, [taskIdParam, tasks]);

  // Keep detail forms updated when taskDetail loads
  useEffect(() => {
    if (taskDetail) {
      const isNewTask = taskDetail.id !== loadedTaskId;
      const activeId = typeof document !== 'undefined' ? document.activeElement?.id : null;
      
      if (isNewTask || activeId !== "task-detail-title") {
        setDetailTitle(taskDetail.title);
      }
      if (isNewTask || activeId !== "task-detail-desc") {
        setNewDetailDesc(taskDetail.description || "");
      }
      
      const isEditingChecklist = activeId?.startsWith("checklist-input-");
      if (isNewTask || !isEditingChecklist) {
        setDetailChecklist(taskDetail.checklist || []);
      }
      
      setDetailStatus(taskDetail.status);
      setDetailPriority(taskDetail.priority);
      setDetailType(taskDetail.taskType);
      setDetailDueDate(taskDetail.dueDate ? taskDetail.dueDate.split("T")[0] : "");
      setDetailAssignee(taskDetail.assigneeId || "");
      setDetailParentId(taskDetail.parentId || "");
      setLoadedTaskId(taskDetail.id);
    } else {
      setLoadedTaskId(null);
      setDetailParentId("");
      setDetailChecklist([]);
    }
  }, [taskDetail, loadedTaskId]);

  // Create Task Mutation
  const createTaskMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post("/tasks", payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setNewTaskTitle("");
      setNewTaskDesc("");
      setNewTaskPriority("MEDIUM");
      setNewTaskType("TASK");
      setNewTaskDueDate("");
      setNewTaskAssignees([]);
      setNewTaskTags([]);
      setNewTagInput("");
      setNewTaskParentId("");
      setIsCreateOpen(false);
    }
  });

  // Update Task Mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const res = await api.patch(`/tasks/${id}`, payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-detail", data.id] });
    }
  });

  // Delete Task Mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setSelectedTask(null);
    }
  });

  // Add Comment Mutation
  const addCommentMutation = useMutation({
    mutationFn: async ({ taskId, content, parentId, attachments }: { taskId: string; content: string; parentId?: string; attachments?: any[] }) => {
      const res = await api.post(`/tasks/${taskId}/comments`, { content, parentId, attachments });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-detail", selectedTask?.id] });
      setNewCommentText("");
      setReplyToId(null);
      setReplyToUser(null);
      setCommentAttachments([]);
    }
  });

  // Attachments Mutation
  const uploadAttachmentMutation = useMutation({
    mutationFn: async ({ taskId, filename, base64Data }: { taskId: string; filename: string; base64Data: string }) => {
      const res = await api.post(`/tasks/${taskId}/attachments`, { filename, base64Data });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-detail", selectedTask?.id] });
    }
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: async (fileId: string) => {
      await api.delete(`/tasks/attachments/${fileId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-detail", selectedTask?.id] });
    }
  });

  const handleCreateTemplateStart = () => {
    setEditingTemplateId(null);
    setTemplateForm({
      templateName: "Monitoring Activity",
      title: "New task",
      description: "",
      priority: "MEDIUM",
      taskType: "TASK",
      checklist: [],
      repeatInterval: "NONE",
      repeatTime: "09:00",
      repeatDayOfWeek: 1,
      repeatDayOfMonth: 1,
      tags: []
    });
    setIsTemplateEditorOpen(true);
  };

  const handleEditTemplateStart = (template: any) => {
    setEditingTemplateId(template.id);
    setTemplateForm({
      templateName: template.templateName,
      title: template.title,
      description: template.description || "",
      priority: template.priority || "MEDIUM",
      taskType: template.taskType || "TASK",
      checklist: template.checklist || [],
      repeatInterval: template.repeatInterval || "NONE",
      repeatTime: template.repeatTime || "09:00",
      repeatDayOfWeek: template.repeatDayOfWeek !== null && template.repeatDayOfWeek !== undefined ? template.repeatDayOfWeek : 1,
      repeatDayOfMonth: template.repeatDayOfMonth !== null && template.repeatDayOfMonth !== undefined ? template.repeatDayOfMonth : 1,
      tags: template.tags || []
    });
    setIsTemplateEditorOpen(true);
  };

  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateForm.templateName.trim() || !templateForm.title.trim()) return;

    if (editingTemplateId) {
      updateTemplateMutation.mutate({
        id: editingTemplateId,
        payload: templateForm
      });
    } else {
      createTemplateMutation.mutate(templateForm);
    }
  };

  const handleDeleteTemplate = (id: string) => {
    if (confirm("Are you sure you want to delete this template?")) {
      deleteTemplateMutation.mutate(id);
    }
  };

  const handleUseTemplate = (template: any) => {
    useTemplateMutation.mutate(template);
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    createTaskMutation.mutate({
      title: newTaskTitle,
      description: newTaskDesc,
      status: preselectedStatus,
      priority: newTaskPriority,
      taskType: newTaskType,
      dueDate: newTaskDueDate || undefined,
      assigneeIds: newTaskAssignees,
      tags: newTaskTags,
      projectId: projectIdParam || undefined,
      parentId: newTaskParentId || undefined
    });
  };

  const handleFieldUpdate = (field: string, value: any) => {
    if (!selectedTask?.id) return;
    updateTaskMutation.mutate({
      id: selectedTask.id,
      payload: { [field]: value }
    });
  };

  const handleCheckboxToggle = (task: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = task.status === "DONE" ? "NOT_STARTED" : "DONE";
    updateTaskMutation.mutate({
      id: task.id,
      payload: { status: newStatus }
    });
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !selectedTask?.id) return;
    addCommentMutation.mutate({
      taskId: selectedTask.id,
      content: newCommentText,
      parentId: replyToId || undefined,
      attachments: commentAttachments
    });
  };

  // Checklist Helpers
  const handleUpdateChecklistItemLocal = (itemId: string, text: string) => {
    setDetailChecklist((prev) => 
      prev.map((item) => (item.id === itemId ? { ...item, text } : item))
    );
  };

  const handleToggleChecklistItem = (itemId: string, isDone: boolean) => {
    setDetailChecklist((prev) => {
      const updated = prev.map((item) => (item.id === itemId ? { ...item, isDone } : item));
      handleFieldUpdate("checklist", updated);
      return updated;
    });
  };

  const handleAddChecklistItem = () => {
    const newItem = {
      id: Math.random().toString(36).substring(2, 11),
      text: "",
      isDone: false
    };
    setDetailChecklist((prev) => {
      const updated = [...prev, newItem];
      handleFieldUpdate("checklist", updated);
      return updated;
    });
    
    // Focus the new item input after creation
    setTimeout(() => {
      const el = document.getElementById(`checklist-input-${newItem.id}`);
      if (el) el.focus();
    }, 50);
  };

  const handleDeleteChecklistItem = (itemId: string) => {
    setDetailChecklist((prev) => {
      const updated = prev.filter((item) => item.id !== itemId);
      handleFieldUpdate("checklist", updated);
      return updated;
    });
  };

  // Followers Helpers
  const handleToggleFollower = (userId: string) => {
    if (!taskDetail) return;
    const currentFollowers = taskDetail.followers || [];
    const exists = currentFollowers.some((f: any) => f.id === userId);
    const updatedFollowers = exists
      ? currentFollowers.filter((f: any) => f.id !== userId)
      : [...currentFollowers, { id: userId }];
    
    handleFieldUpdate("followers", updatedFollowers.map((f: any) => f.id));
  };

  // Assignees Helpers
  const handleToggleAssignee = (userId: string) => {
    if (!taskDetail) return;
    const currentAssignees = taskDetail.assignees || [];
    const exists = currentAssignees.some((a: any) => a.id === userId);
    const updatedAssignees = exists
      ? currentAssignees.filter((a: any) => a.id !== userId)
      : [...currentAssignees, { id: userId }];
    
    handleFieldUpdate("assigneeIds", updatedAssignees.map((a: any) => a.id));
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setActiveDragId(taskId);
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setActiveDragId(null);
    setDraggedOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    if (draggedOverColumn !== columnId) {
      setDraggedOverColumn(columnId);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // Only clear if leaving the container itself
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setDraggedOverColumn(null);
    }
  };

  const handleDrop = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain") || activeDragId;
    setActiveDragId(null);
    setDraggedOverColumn(null);

    if (taskId) {
      const task = tasks?.find((t: any) => t.id === taskId);
      if (task && task.status !== columnId) {
        updateTaskMutation.mutate({
          id: taskId,
          payload: { status: columnId }
        });
      }
    }
  };

  // Get all unique tags from active tasks
  const uniqueTags = Array.from(new Set(tasks?.flatMap((t: any) => t.tags || []) || [])) as string[];

  // Filtering tasks locally
  const filteredTasks = tasks?.filter((task: any) => {
    if (projectIdParam && task.projectId !== projectIdParam) {
      return false;
    }
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesPriority = priorityFilter === "ALL" || task.priority === priorityFilter;
    const matchesType = typeFilter === "ALL" || task.taskType === typeFilter;
    const matchesTag = tagFilter === "ALL" || (task.tags && task.tags.includes(tagFilter));
    return matchesSearch && matchesPriority && matchesType && matchesTag;
  }) || [];

  // Helper to find immediate subtasks of a task
  const getSubtasksOf = (taskId: string) => {
    return tasks?.filter((t: any) => t.parentId === taskId) || [];
  };

  // Helper to check recursively if a task or any of its descendants matches the filter
  const taskOrDescendantMatches = (task: any): boolean => {
    const matchesThis = filteredTasks.some((ft: any) => ft.id === task.id);
    if (matchesThis) return true;
    const children = getSubtasksOf(task.id);
    return children.some((child: any) => taskOrDescendantMatches(child));
  };



  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        <MobileNav />
        <main className="page-container overflow-y-auto custom-scrollbar">
          <div className="w-full">
          {!projectIdParam ? (
            <div className="space-y-8">
              <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <PageHeader title="Tasks Tracker Workspaces" subtitle="Manage multiple tracker boards to organize your tasks" />
                </div>
                <button
                  onClick={() => setIsCreateProjectOpen(true)}
                  className="btn-primary flex items-center gap-1.5 py-2 px-4 rounded-xl text-xs font-bold transition-all duration-200 active:scale-95 self-start md:self-auto"
                >
                  <Plus className="w-4 h-4" /> New Tracker Workspace
                </button>
              </header>

              {/* Workspaces Grid */}
              {isLoadingProjects ? (
                <div className="flex flex-col items-center justify-center py-32 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Loading workspaces...</span>
                </div>
              ) : !projects || projects.length === 0 ? (
                <div className="glass-card flex flex-col items-center justify-center py-24 text-center border-dashed border-2 border-slate-200/80">
                  <div className="w-16 h-16 rounded-2xl bg-blue-50/50 flex items-center justify-center mb-4 text-blue-600">
                    <CheckSquare className="w-8 h-8" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 mb-1">Create Your First Tracker Workspace</h3>
                  <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
                    Trackers let you organize separate todo lists or boards for different projects or activities, like Notion.
                  </p>
                  <button
                    onClick={() => setIsCreateProjectOpen(true)}
                    className="btn-primary flex items-center gap-1.5 py-2 px-4 rounded-xl text-xs font-bold transition-all duration-200 active:scale-95"
                  >
                    <Plus className="w-4 h-4" /> Create Tracker
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {projects.map((project: any) => {
                    const totalTasks = project.tasks?.length || 0;
                    const completedTasks = project.tasks?.filter((t: any) => t.status === "DONE").length || 0;
                    const percentComplete = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

                    return (
                      <div
                        key={project.id}
                        onClick={() => router.push(`/tasks?projectId=${project.id}`)}
                        className="group relative flex flex-col justify-between bg-white border border-slate-100 hover:border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md cursor-pointer transition-all duration-200 min-h-[160px]"
                      >
                        {/* Top Indicator Line */}
                        <div 
                          className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl" 
                          style={{ backgroundColor: project.colorCode || "#4F46E5" }}
                        />

                        <div className="pl-2.5 flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <h3 className="text-sm font-bold text-slate-800 mb-0 group-hover:text-blue-600 transition-colors truncate">
                                {project.name}
                              </h3>
                              
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingProjectId(project.id);
                                    setEditProjectName(project.name);
                                    setEditProjectDesc(project.description || "");
                                    setEditProjectColor(project.colorCode || "#4F46E5");
                                    setIsEditProjectOpen(true);
                                  }}
                                  className="p-1 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
                                  title="Rename Workspace"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => handleDeleteProject(project.id, e)}
                                  className="p-1 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
                                  title="Delete Workspace"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-4">
                              {project.description || "No description provided."}
                            </p>
                          </div>

                          <div className="space-y-2 mt-auto">
                            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              <span>Tasks: {completedTasks}/{totalTasks}</span>
                              <span>{percentComplete}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                                style={{ 
                                  width: `${percentComplete}%`,
                                  backgroundColor: project.colorCode || "#4F46E5"
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="w-full">
              {/* Header Ribbon */}
              <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <button onClick={() => router.push("/tasks")} className="hover:text-blue-600 transition-colors">
                      Workspaces
                    </button>
                    <ChevronRight className="w-3.5 h-3.5" />
                    <span style={{ color: activeProject?.colorCode || "#4F46E5" }}>
                      {activeProject?.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-xl font-bold text-slate-900 tracking-tight mb-0">
                      {activeProject?.name}
                    </h1>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          if (activeProject) {
                            setEditingProjectId(activeProject.id);
                            setEditProjectName(activeProject.name);
                            setEditProjectDesc(activeProject.description || "");
                            setEditProjectColor(activeProject.colorCode || "#4F46E5");
                            setIsEditProjectOpen(true);
                          }
                        }}
                        className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
                        title="Rename Tracker"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => activeProject && handleDeleteProject(activeProject.id, e)}
                        className="p-1 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
                        title="Delete Tracker"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 font-medium">{activeProject?.description || "No description provided."}</p>
                </div>

                {/* View Tabs */}
                <div className="bg-slate-100 p-0.5 rounded-xl border border-slate-200/40 flex items-center gap-0.5 self-start md:self-auto">
                  <button 
                    onClick={() => setActiveTab("board")}
                    className={cn(
                      "px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all duration-200 active:scale-95",
                      activeTab === "board" ? "bg-white text-slate-800 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    <Grid className="w-3.5 h-3.5" /> By Status
                  </button>
                  <button 
                    onClick={() => setActiveTab("list")}
                    className={cn(
                      "px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all duration-200 active:scale-95",
                      activeTab === "list" ? "bg-white text-slate-800 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    <List className="w-3.5 h-3.5" /> All Tasks
                  </button>
                </div>
              </header>

              {/* Toolbar */}
              <section className="mb-6 flex flex-wrap gap-4 items-center justify-between">
                <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
                  {/* Live Search */}
                  <div className="relative group flex-1 max-w-xs">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                    <input 
                      type="text" 
                      placeholder="Search tasks..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="input-field pl-10 w-full bg-white !py-2"
                    />
                  </div>

                  {/* Filter Priority */}
                  <div className="relative">
                    <select
                      value={priorityFilter}
                      onChange={(e) => setPriorityFilter(e.target.value)}
                      className="input-field pr-10 w-44 appearance-none bg-white !py-2 cursor-pointer"
                    >
                      <option value="ALL">All Priorities</option>
                      <option value="HIGH">High Priority</option>
                      <option value="MEDIUM">Medium Priority</option>
                      <option value="LOW">Low Priority</option>
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>

                  {/* Filter Task Type */}
                  <div className="relative">
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                      className="input-field pr-10 w-40 appearance-none bg-white !py-2 cursor-pointer"
                    >
                      <option value="ALL">All Types</option>
                      {TASK_TYPES.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>

                  {/* Filter Tags */}
                  <div className="relative">
                    <select
                      value={tagFilter}
                      onChange={(e) => setTagFilter(e.target.value)}
                      className="input-field pr-10 w-40 appearance-none bg-white !py-2 cursor-pointer"
                    >
                      <option value="ALL">All Tags</option>
                      {uniqueTags.map(tag => (
                        <option key={tag} value={tag}>#{tag}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="flex items-center">
                  <button 
                    onClick={() => {
                      setPreselectedStatus("NOT_STARTED");
                      setIsCreateOpen(true);
                    }}
                    className="btn-primary rounded-r-none border-r border-blue-600/30 flex items-center h-10"
                  >
                    <Plus className="w-4 h-4 mr-1.5" /> New Task
                  </button>
                  
                  <div className="relative group/template-dd flex h-10">
                    <button 
                      type="button"
                      className="btn-primary rounded-l-none px-2.5 flex items-center justify-center h-10 cursor-pointer"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    
                    {/* Templates Dropdown Menu */}
                    <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200/80 rounded-2xl shadow-2xl p-2.5 z-[100] opacity-0 pointer-events-none group-focus-within/template-dd:opacity-100 group-focus-within/template-dd:pointer-events-auto transition-all space-y-1.5">
                      <div className="px-3 py-1.5 border-b border-slate-100/60 flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Templates</span>
                        <button 
                          type="button"
                          onClick={() => handleCreateTemplateStart()}
                          className="text-[9px] font-extrabold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100/50 px-2.5 py-1 rounded-lg uppercase transition-all duration-200 active:scale-95 cursor-pointer"
                        >
                          + New Template
                        </button>
                      </div>
                      
                      <div className="max-h-48 overflow-y-auto custom-scrollbar py-1 space-y-1">
                        {!templates || templates.length === 0 ? (
                          <div className="text-center py-5 text-slate-400 text-[10px] font-semibold uppercase tracking-wider">
                            No templates found
                          </div>
                        ) : (
                          templates.map((t: any) => (
                            <div key={t.id} className="flex items-center justify-between hover:bg-slate-50/70 rounded-xl px-2.5 py-1.5 group/item transition-all duration-150">
                              <button
                                type="button"
                                onClick={() => handleUseTemplate(t)}
                                className="flex-1 text-left text-[11px] font-bold text-slate-700 hover:text-blue-600 transition-colors truncate pr-2 cursor-pointer"
                              >
                                <span className="bg-amber-100/60 text-amber-800 text-[8px] font-black uppercase tracking-tight px-1.5 py-0.5 rounded mr-2 border border-amber-200/40">
                                  Blueprint
                                </span>
                                {t.templateName}
                              </button>
                              
                              <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={() => handleEditTemplateStart(t)}
                                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                                  title="Edit Template Blueprint"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTemplate(t.id)}
                                  className="p-1 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                                  title="Delete Template Blueprint"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Content Area */}
              <div className="w-full">
                {isLoadingTasks ? (
                  <div className="flex flex-col items-center justify-center py-32 gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Loading tasks vault...</span>
                  </div>
                ) : activeTab === "board" ? (
                  /* ==================== KANBAN BOARD VIEW ==================== */
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
                    {STATUSES.map((col) => {
                      const columnTasks = filteredTasks.filter(t => t.status === col.id && (!t.parentId || !tasks?.some((pt: any) => pt.id === t.parentId)));
                      return (
                        <div key={col.id} className="flex flex-col max-h-[75vh]">
                          {/* Column Header */}
                          <div className="flex items-center justify-between mb-4 px-2">
                            <div className="flex items-center gap-2">
                              <span className={cn("px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase border tracking-widest flex items-center gap-1.5", col.color)}>
                                <span className={cn("w-1.5 h-1.5 rounded-full", col.dot)} /> {col.label}
                              </span>
                              <span className="text-[10px] font-extrabold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">{columnTasks.length}</span>
                            </div>
                            <button 
                              onClick={() => {
                                setPreselectedStatus(col.id);
                                setIsCreateOpen(true);
                              }}
                              className="p-1 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Cards Container */}
                          <div 
                            onDragOver={(e) => handleDragOver(e, col.id)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, col.id)}
                            className={cn(
                              "space-y-4 overflow-y-auto custom-scrollbar flex-1 pb-10 min-h-[150px] transition-all duration-200 rounded-2xl px-1",
                              draggedOverColumn === col.id ? "bg-blue-50/40 ring-2 ring-dashed ring-blue-300 shadow-inner scale-[0.99]" : "bg-transparent"
                            )}
                          >
                            {columnTasks.length === 0 ? (
                              <div className="border border-dashed border-slate-200 rounded-2xl p-6 text-center bg-white/20">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">No tasks</span>
                              </div>
                            ) : (
                              columnTasks.map((task) => {
                                const priorityObj = PRIORITIES.find(p => p.id === task.priority);
                                return (
                                    <motion.div
                                      layoutId={task.id}
                                      key={task.id}
                                      draggable={true}
                                      onDragStart={(e: any) => handleDragStart(e, task.id)}
                                      onDragEnd={handleDragEnd as any}
                                      onClick={() => setSelectedTask(task)}
                                    className={cn(
                                      "p-4 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow-md hover:border-slate-200 cursor-pointer transition-all relative group flex flex-col gap-3",
                                      activeDragId === task.id ? "opacity-30 border-dashed border-blue-300 shadow-none scale-[0.98]" : "opacity-100"
                                    )}
                                    whileHover={{ y: -2 }}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex items-start gap-2.5 min-w-0">
                                        <button
                                          onClick={(e) => handleCheckboxToggle(task, e)}
                                          className="mt-0.5 shrink-0 transition-transform active:scale-95 text-slate-300 hover:text-blue-500"
                                        >
                                          {task.status === "DONE" ? (
                                            <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 fill-emerald-50" />
                                          ) : (
                                            <CheckSquare className="w-4.5 h-4.5 text-slate-200 hover:border-blue-400" />
                                          )}
                                        </button>
                                        <h3 className={cn("text-[11px] font-bold text-slate-800 leading-snug break-words mb-0", task.status === "DONE" && "line-through text-slate-400")}>
                                          {task.title}
                                        </h3>
                                      </div>
                                    </div>

                                    {task.description && (
                                      <p className="text-[10px] font-medium text-slate-400 line-clamp-2 leading-relaxed">
                                        {task.description}
                                      </p>
                                    )}

                                    {/* Subtasks progress & list indicator */}
                                    {(() => {
                                      const children = getSubtasksOf(task.id);
                                      if (children.length === 0) return null;
                                      const completedChildren = children.filter(c => c.status === "DONE").length;
                                      const percent = Math.round((completedChildren / children.length) * 100);
                                      return (
                                        <div className="space-y-1.5 pt-1">
                                          <div className="flex items-center justify-between text-[9px] font-bold text-slate-400">
                                            <span className="flex items-center gap-1"><CornerDownRight className="w-3 h-3 text-slate-350" /> Sub-tasks ({completedChildren}/{children.length})</span>
                                            <span>{percent}%</span>
                                          </div>
                                          <div className="w-full bg-slate-100 rounded-full h-1">
                                            <div className="bg-blue-600 h-1 rounded-full" style={{ width: `${percent}%` }} />
                                          </div>
                                        </div>
                                      );
                                    })()}

                                    {task.tags && task.tags.length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {task.tags.map((tag: string) => (
                                          <span key={tag} className="bg-slate-50 text-slate-500 border border-slate-200/50 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide">
                                            #{tag}
                                          </span>
                                        ))}
                                      </div>
                                    )}

                                    {/* Footer details */}
                                    <div className="flex items-center justify-between border-t border-slate-50 pt-3 mt-1 gap-2">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        {priorityObj && (
                                          <span className={cn("px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tight border", priorityObj.color)}>
                                            {priorityObj.label}
                                          </span>
                                        )}

                                        <span className="bg-blue-50/50 text-blue-600 border border-blue-100/30 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tight">
                                          {task.taskType}
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-3 shrink-0">
                                        {task._count?.comments > 0 && (
                                          <div className="flex items-center gap-1 text-slate-400">
                                            <MessageSquare className="w-3.5 h-3.5" />
                                            <span className="text-[9px] font-black">{task._count.comments}</span>
                                          </div>
                                        )}

                                        {task.assignees && task.assignees.length > 0 ? (
                                          <div className="flex items-center -space-x-1.5 overflow-hidden">
                                            {task.assignees.slice(0, 3).map((a: any) => (
                                              <div 
                                                key={a.id}
                                                className="w-5.5 h-5.5 rounded-full bg-blue-100 flex items-center justify-center text-[9px] font-black text-blue-600 border border-white shadow-sm ring-1 ring-blue-200"
                                                title={`Assigned to ${a.fullName}`}
                                              >
                                                {a.fullName.charAt(0).toUpperCase()}
                                              </div>
                                            ))}
                                            {task.assignees.length > 3 && (
                                              <div className="w-5.5 h-5.5 rounded-full bg-slate-200 border border-white flex items-center justify-center text-[8px] font-bold text-slate-600 shadow-sm">
                                                +{task.assignees.length - 3}
                                              </div>
                                            )}
                                          </div>
                                        ) : (
                                          <div className="w-5.5 h-5.5 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
                                            <User className="w-2.5 h-2.5" />
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </motion.div>
                                );
                              })
                            )}

                            <button 
                              onClick={() => {
                                setPreselectedStatus(col.id);
                                setIsCreateOpen(true);
                              }}
                              className="w-full py-2.5 border border-dashed border-slate-200 hover:border-blue-300 rounded-xl flex items-center justify-center gap-1.5 text-[9px] font-extrabold text-slate-400 uppercase tracking-widest hover:text-blue-600 hover:bg-blue-50/10 transition-all duration-200"
                            >
                              <Plus className="w-3.5 h-3.5" /> Add card
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* ==================== LIST / CHECKLIST VIEW ==================== */
                  <div className="glass-card !p-0 overflow-hidden ring-1 ring-slate-200/60 shadow-xl shadow-slate-200/10">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Task Ledger</span>
                      <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200/60 px-3 py-1 rounded-full">{filteredTasks.length} total tasks</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {filteredTasks.length === 0 ? (
                        <div className="p-12 text-center text-slate-400">
                          <CheckSquare className="w-8 h-8 mx-auto mb-3 text-slate-200" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">No tasks matching search filters</span>
                        </div>
                      ) : (
                        (() => {
                          const rootTasks = tasks?.filter((t: any) => {
                            if (projectIdParam && t.projectId !== projectIdParam) return false;
                            if (!t.parentId) return true;
                            return !tasks.some((pt: any) => pt.id === t.parentId);
                          }) || [];

                          const visibleRoots = rootTasks.filter(taskOrDescendantMatches);

                          if (visibleRoots.length === 0) {
                            return (
                              <div className="p-12 text-center text-slate-400">
                                <CheckSquare className="w-8 h-8 mx-auto mb-3 text-slate-200" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">No matching tasks found in hierarchy</span>
                              </div>
                            );
                          }

                          return visibleRoots.map(rootTask => (
                            <TaskTreeRow
                              key={rootTask.id}
                              task={rootTask}
                              depth={0}
                              STATUSES={STATUSES}
                              PRIORITIES={PRIORITIES}
                              expandedTaskIds={expandedTaskIds}
                              setExpandedTaskIds={setExpandedTaskIds}
                              filteredTasks={filteredTasks}
                              setSelectedTask={setSelectedTask}
                              handleCheckboxToggle={handleCheckboxToggle}
                              getSubtasksOf={getSubtasksOf}
                              taskOrDescendantMatches={taskOrDescendantMatches}
                            />
                          ));
                        })()
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        {/* ==================== CREATE TASK MODAL ==================== */}
        <AnimatePresence>
          {isCreateOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl w-full max-w-lg border border-slate-100 shadow-2xl overflow-hidden"
              >
                <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Create New Task</span>
                  </div>
                  <button 
                    onClick={() => setIsCreateOpen(false)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-900 transition-all animate-none"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleCreateTask} className="p-6 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Task Title</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Buat Artikel 'Check License Windows'"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      className="input-field w-full bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Description</label>
                    <textarea 
                      placeholder="Enter detailed description here..."
                      value={newTaskDesc}
                      onChange={(e) => setNewTaskDesc(e.target.value)}
                      className="input-field w-full min-h-[80px] bg-white resize-none font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Priority</label>
                      <div className="relative">
                        <select 
                          value={newTaskPriority}
                          onChange={(e) => setNewTaskPriority(e.target.value)}
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
                      <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Task Type</label>
                      <div className="relative">
                        <select 
                          value={newTaskType}
                          onChange={(e) => setNewTaskType(e.target.value)}
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

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Due Date</label>
                      <input 
                        type="date" 
                        value={newTaskDueDate}
                        onChange={(e) => setNewTaskDueDate(e.target.value)}
                        className="input-field w-full bg-white"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Assignees</label>
                      <div className="relative group/create-as">
                        <button 
                          type="button"
                          className="input-field w-full bg-white text-left flex items-center justify-between !py-2 cursor-pointer"
                        >
                          <span className="truncate text-slate-500 font-medium">
                            {newTaskAssignees.length === 0 
                              ? "Select Assignees..." 
                              : `${newTaskAssignees.length} selected`}
                          </span>
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        </button>
                        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl p-2 z-50 opacity-0 pointer-events-none group-focus-within/create-as:opacity-100 group-focus-within/create-as:pointer-events-auto transition-all max-h-48 overflow-y-auto">
                          {users?.map((u: any) => {
                            const isChecked = newTaskAssignees.includes(u.id);
                            return (
                              <button 
                                key={u.id}
                                type="button"
                                onClick={() => {
                                  setNewTaskAssignees(prev => 
                                    isChecked ? prev.filter(id => id !== u.id) : [...prev, u.id]
                                  );
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg text-[10px] font-bold text-slate-700 flex items-center justify-between transition-colors"
                              >
                                <span>{u.fullName}</span>
                                <div className={cn(
                                  "w-4 h-4 border rounded flex items-center justify-center transition-colors",
                                  isChecked ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300"
                                )}>
                                  {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Parent Task Selector */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Parent Task</label>
                    <div className="relative">
                      <select 
                        value={newTaskParentId}
                        onChange={(e) => setNewTaskParentId(e.target.value)}
                        className="input-field pr-10 w-full bg-white cursor-pointer appearance-none"
                      >
                        <option value="">None (Root Task)</option>
                        {tasks?.filter((t: any) => !t.parentId && (!projectIdParam || t.projectId === projectIdParam)).map((t: any) => (
                          <option key={t.id} value={t.id}>{t.title}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Tags</label>
                    <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200/80 rounded-xl min-h-[42px] items-center">
                      {newTaskTags.map((tag) => (
                        <span key={tag} className="bg-white text-slate-600 border border-slate-200 px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 shadow-sm">
                          #{tag}
                          <button
                            type="button"
                            onClick={() => setNewTaskTags(prev => prev.filter(t => t !== tag))}
                            className="text-slate-400 hover:text-slate-600 p-0.5 rounded animate-none"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      <input
                        type="text"
                        placeholder={newTaskTags.length === 0 ? "Type tag and press Enter..." : ""}
                        value={newTagInput}
                        onChange={(e) => setNewTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ',') {
                            e.preventDefault();
                            const val = newTagInput.trim().replace(/,/g, '');
                            if (val && !newTaskTags.includes(val)) {
                              setNewTaskTags(prev => [...prev, val]);
                            }
                            setNewTagInput("");
                          }
                        }}
                        className="bg-transparent border-none focus:outline-none focus:ring-0 p-0 text-xs font-bold text-slate-700 placeholder-slate-400 flex-1 outline-none min-w-[120px]"
                      />
                    </div>
                    {/* Suggested Existing Tags */}
                    {uniqueTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 items-center pt-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mr-1">Suggestions:</span>
                        {uniqueTags.filter(t => !newTaskTags.includes(t)).slice(0, 5).map(tag => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => setNewTaskTags(prev => [...prev, tag])}
                            className="bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700 px-2 py-1 rounded text-[11px] font-bold border border-slate-200/50 transition-all cursor-pointer animate-none"
                          >
                            +{tag}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-50">
                    <button 
                      type="button" 
                      onClick={() => setIsCreateOpen(false)}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="btn-primary"
                    >
                      Create Task
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

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
                {/* Notion Style Golden Yellow Banner Ribbon */}
                <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-3 flex flex-wrap items-center justify-between text-amber-800 gap-3 rounded-t-2xl relative overflow-visible">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <span className="animate-pulse w-2 h-2 bg-amber-500 rounded-full" />
                    <span>You're editing a template in</span>
                    <span className="bg-amber-500/20 text-amber-900 px-2.5 py-1 rounded-lg flex items-center gap-1 border border-amber-500/20">
                      <Check className="w-3.5 h-3.5 text-amber-700 stroke-[3]" />
                      <input 
                        type="text"
                        value={templateForm.templateName}
                        onChange={(e) => setTemplateForm(prev => ({ ...prev, templateName: e.target.value }))}
                        className="bg-transparent border-none focus:outline-none focus:ring-0 p-0 text-xs font-black text-amber-900 w-36 outline-none"
                        placeholder="Template Name..."
                      />
                    </span>
                    <span 
                      className="text-amber-600/70 hover:text-amber-800 cursor-help font-bold text-xs" 
                      title="Templates are blueprints used to create tasks. Changes here will not affect existing tasks."
                    >
                      [?]
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

                <form onSubmit={handleSaveTemplate} className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
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
                        {/* If Weekly, show Day of Week Select */}
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

                        {/* If Monthly, show Day of Month Input */}
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

                        {/* Repeat Time Input */}
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

                  {/* Tags blueprint section */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-50">
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Default Tags Blueprint</label>
                    <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200/80 rounded-xl min-h-[42px] items-center">
                      {templateForm.tags?.map((tag) => (
                        <span key={tag} className="bg-white text-slate-600 border border-slate-200 px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 shadow-sm animate-none">
                          #{tag}
                          <button
                            type="button"
                            onClick={() => setTemplateForm(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }))}
                            className="text-slate-400 hover:text-slate-600 p-0.5 rounded animate-none"
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
                    {/* Suggested Existing Tags */}
                    {uniqueTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 items-center pt-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mr-1">Suggestions:</span>
                        {uniqueTags.filter(t => !templateForm.tags?.includes(t)).slice(0, 5).map(tag => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => setTemplateForm(prev => ({ ...prev, tags: [...(prev.tags || []), tag] }))}
                            className="bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700 px-2 py-1 rounded text-[11px] font-bold border border-slate-200/50 transition-all cursor-pointer animate-none"
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

        {/* ==================== NOTION-STYLE SIDE DETAIL DRAWER ==================== */}
        <AnimatePresence>
          {selectedTask && (
            <div className="fixed inset-0 z-40 flex justify-end">
              {/* Backdrop */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.3 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedTask(null)}
                className="absolute inset-0 bg-slate-950"
              />

              {/* Drawer Container */}
              <motion.div 
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className={cn(
                  "bg-white h-full border-l border-slate-100 shadow-2xl relative flex flex-col z-10 transition-all duration-300",
                  drawerWidth === "normal" ? "w-full max-w-2xl" : drawerWidth === "wide" ? "w-full max-w-5xl" : "w-full max-w-full"
                )}
              >
                 {/* Drawer Header */}
                 <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                   <div className="flex items-center gap-2">
                     <span className="text-[10px] font-extrabold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100/50 uppercase tracking-widest">Task Details</span>
                     {taskDetail?.parentId && (() => {
                       const parentTask = tasks?.find((t: any) => t.id === taskDetail.parentId);
                       if (!parentTask) return null;
                       return (
                         <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400">
                           <span>/</span>
                           <button 
                             onClick={() => setSelectedTask(parentTask)}
                             className="hover:text-blue-600 hover:underline truncate max-w-[150px]"
                             title={`Go to parent: ${parentTask.title}`}
                           >
                             {parentTask.title}
                           </button>
                         </div>
                       );
                     })()}
                   </div>
                  <div className="flex items-center gap-3">
                    {/* Copy Share Link */}
                    <button 
                      onClick={async () => {
                        const url = `${window.location.origin}${window.location.pathname}?taskId=${selectedTask.id}`;
                        await navigator.clipboard.writeText(url);
                        setCopyNotification(true);
                        setTimeout(() => setCopyNotification(false), 2000);
                      }}
                      className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-900 transition-all relative"
                      title="Copy Task Share Link"
                    >
                      {copyNotification ? <Check className="w-4 h-4 text-emerald-500" /> : <Link2 className="w-4 h-4" />}
                    </button>

                    {/* Resizable Width Toggle */}
                    <button 
                      onClick={() => {
                        setDrawerWidth(prev => prev === "normal" ? "wide" : prev === "wide" ? "full" : "normal");
                      }}
                      className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-900 transition-all"
                      title="Toggle Width"
                    >
                      {drawerWidth === "normal" ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                    </button>

                    {/* Delete Task */}
                    <button 
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this task?")) {
                          deleteTaskMutation.mutate(selectedTask.id);
                        }
                      }}
                      className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-all"
                      title="Delete Task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <button 
                      onClick={() => setSelectedTask(null)}
                      className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-900 transition-all"
                    >
                      <X className="w-4.5 h-4.5" />
                    </button>
                  </div>
                </div>

                {/* Drawer Body */}
                <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
                  {/* Task Title */}
                  <div className="space-y-1">
                    <input 
                      id="task-detail-title"
                      type="text" 
                      value={detailTitle}
                      onChange={(e) => setDetailTitle(e.target.value)}
                      onBlur={() => handleFieldUpdate("title", detailTitle)}
                      className="text-xl font-bold text-slate-900 border-none outline-none focus:ring-0 p-0 w-full bg-transparent"
                    />
                  </div>

                  {/* Properties Ledger Grid */}
                  <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-5 space-y-4">
                    {/* Status Input */}
                    <div className="grid grid-cols-3 items-center gap-4">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Status</span>
                      <div className="col-span-2 relative">
                        <select 
                          value={detailStatus}
                          onChange={(e) => {
                            setDetailStatus(e.target.value);
                            handleFieldUpdate("status", e.target.value);
                          }}
                          className="input-field pr-10 w-full bg-white cursor-pointer appearance-none !py-2"
                        >
                          {STATUSES.map((s) => (
                            <option key={s.id} value={s.id}>{s.label}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>

                    {/* Priority Input */}
                    <div className="grid grid-cols-3 items-center gap-4">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> Priority</span>
                      <div className="col-span-2 relative">
                        <select 
                          value={detailPriority}
                          onChange={(e) => {
                            setDetailPriority(e.target.value);
                            handleFieldUpdate("priority", e.target.value);
                          }}
                          className="input-field pr-10 w-full bg-white cursor-pointer appearance-none !py-2"
                        >
                          <option value="LOW">Low</option>
                          <option value="MEDIUM">Medium</option>
                          <option value="HIGH">High</option>
                        </select>
                        <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>

                    {/* Task Type Input */}
                    <div className="grid grid-cols-3 items-center gap-4">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" /> Task Type</span>
                      <div className="col-span-2 relative">
                        <select 
                          value={detailType}
                          onChange={(e) => {
                            setDetailType(e.target.value);
                            handleFieldUpdate("taskType", e.target.value);
                          }}
                          className="input-field pr-10 w-full bg-white cursor-pointer appearance-none !py-2"
                        >
                          {TASK_TYPES.map((t: string) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>

                    {/* Due Date Input */}
                    <div className="grid grid-cols-3 items-center gap-4">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Due Date</span>
                      <div className="col-span-2">
                        <input 
                          type="date"
                          value={detailDueDate}
                          onChange={(e) => {
                            setDetailDueDate(e.target.value);
                            handleFieldUpdate("dueDate", e.target.value || null);
                          }}
                          className="input-field w-full bg-white !py-2"
                        />
                      </div>
                    </div>

                    {/* Assignees Widget (Multiple Support) */}
                    <div className="grid grid-cols-3 items-start gap-4">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mt-1.5"><User className="w-3.5 h-3.5" /> Assignee</span>
                      <div className="col-span-2 flex flex-wrap items-center gap-2">
                        {taskDetail?.assignees?.map((a: any) => (
                          <div key={a.id} className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 text-[9px] font-black flex items-center justify-center border border-blue-200 shadow-sm relative group" title={a.fullName}>
                            {a.fullName.charAt(0).toUpperCase()}
                            <button 
                              type="button"
                              onClick={() => handleToggleAssignee(a.id)}
                              className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 text-white rounded-full flex items-center justify-center text-[7px] font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        
                        {/* Assignee drop triggers */}
                        <div className="relative">
                          <button 
                            type="button" 
                            onClick={() => setIsAssigneePanelOpen(!isAssigneePanelOpen)}
                            className="w-6 h-6 rounded-full border border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:text-blue-500 hover:border-blue-400 hover:bg-blue-50/30 transition-all"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          {isAssigneePanelOpen && (
                            <>
                              <div className="fixed inset-0 z-20" onClick={() => setIsAssigneePanelOpen(false)} />
                              <div className="absolute left-0 top-full mt-1.5 w-48 bg-white border border-slate-200/80 rounded-xl shadow-xl p-1.5 z-30 divide-y divide-slate-50 max-h-40 overflow-y-auto">
                                {users?.map((u: any) => {
                                  const isAssigned = taskDetail?.assignees?.some((a: any) => a.id === u.id);
                                  return (
                                    <button 
                                      key={u.id}
                                      type="button"
                                      onClick={() => handleToggleAssignee(u.id)}
                                      className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 rounded-lg text-[10px] font-bold text-slate-700 flex items-center justify-between"
                                    >
                                      <span>{u.fullName}</span>
                                      {isAssigned && <Check className="w-3.5 h-3.5 text-blue-500" />}
                                    </button>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Followers Widget */}
                    <div className="grid grid-cols-3 items-start gap-4">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mt-1.5"><UserPlus className="w-3.5 h-3.5" /> Followers</span>
                      <div className="col-span-2 flex flex-wrap items-center gap-2">
                        {taskDetail?.followers?.map((f: any) => (
                          <div key={f.id} className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 text-[9px] font-black flex items-center justify-center border border-blue-200 shadow-sm relative group" title={f.fullName}>
                            {f.fullName.charAt(0).toUpperCase()}
                            <button 
                              type="button"
                              onClick={() => handleToggleFollower(f.id)}
                              className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 text-white rounded-full flex items-center justify-center text-[7px] font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        
                        {/* Followers drop triggers */}
                        <div className="relative">
                          <button 
                            type="button" 
                            onClick={() => setIsFollowerPanelOpen(!isFollowerPanelOpen)}
                            className="w-6 h-6 rounded-full border border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:text-blue-500 hover:border-blue-400 hover:bg-blue-50/30 transition-all"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          {isFollowerPanelOpen && (
                            <>
                              <div className="fixed inset-0 z-20" onClick={() => setIsFollowerPanelOpen(false)} />
                              <div className="absolute left-0 top-full mt-1.5 w-48 bg-white border border-slate-200/80 rounded-xl shadow-xl p-1.5 z-30 divide-y divide-slate-50 max-h-40 overflow-y-auto">
                                {users?.map((u: any) => {
                                  const isFollowing = taskDetail?.followers?.some((f: any) => f.id === u.id);
                                  return (
                                    <button 
                                      key={u.id}
                                      type="button"
                                      onClick={() => handleToggleFollower(u.id)}
                                      className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 rounded-lg text-[10px] font-bold text-slate-700 flex items-center justify-between"
                                    >
                                      <span>{u.fullName}</span>
                                      {isFollowing && <Check className="w-3.5 h-3.5 text-blue-500" />}
                                    </button>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Tags Input */}
                    <div className="grid grid-cols-3 items-start gap-4">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mt-1.5">
                        <Tag className="w-3.5 h-3.5" /> Tags
                      </span>
                      <div className="col-span-2 flex flex-wrap items-center gap-2">
                        {taskDetail?.tags?.map((tag: string) => (
                          <div key={tag} className="bg-slate-100 text-slate-700 text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 border border-slate-200/40 relative group">
                            #{tag}
                            <button
                              type="button"
                              onClick={() => {
                                const newTags = taskDetail.tags.filter((t: string) => t !== tag);
                                handleFieldUpdate("tags", newTags);
                              }}
                              className="text-slate-400 hover:text-slate-600 p-0.5 rounded animate-none"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        
                        {/* Add Tag Dropdown / Input inline */}
                        <div className="relative">
                          <button 
                            type="button" 
                            onClick={() => setIsTagPanelOpen(!isTagPanelOpen)}
                            className="w-6 h-6 rounded-full border border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:text-blue-500 hover:border-blue-400 hover:bg-blue-50/30 transition-all"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          {isTagPanelOpen && (
                            <>
                              <div className="fixed inset-0 z-20" onClick={() => setIsTagPanelOpen(false)} />
                              <div className="absolute left-0 top-full mt-1.5 w-48 bg-white border border-slate-200/80 rounded-xl shadow-xl p-2.5 z-30 space-y-2">
                                <input
                                  type="text"
                                  placeholder="New tag..."
                                  onKeyDown={(e: any) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      const val = e.target.value.trim();
                                      if (val) {
                                        const currentTags = taskDetail?.tags || [];
                                        if (!currentTags.includes(val)) {
                                          handleFieldUpdate("tags", [...currentTags, val]);
                                        }
                                        e.target.value = "";
                                      }
                                    }
                                  }}
                                  className="input-field w-full bg-slate-50 text-[10px] font-bold !py-1"
                                />
                                {uniqueTags.length > 0 && (
                                  <div className="space-y-1">
                                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Select Existing</div>
                                    <div className="max-h-24 overflow-y-auto custom-scrollbar flex flex-col gap-0.5">
                                      {uniqueTags.filter(t => !taskDetail?.tags?.includes(t)).map(tag => (
                                        <button
                                          key={tag}
                                          type="button"
                                          onClick={() => {
                                            const currentTags = taskDetail?.tags || [];
                                            handleFieldUpdate("tags", [...currentTags, tag]);
                                          }}
                                          className="w-full text-left px-2 py-1 hover:bg-slate-50 rounded-lg text-[9px] font-bold text-slate-700 cursor-pointer animate-none"
                                        >
                                          #{tag}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Parent Task Input */}
                    <div className="grid grid-cols-3 items-center gap-4">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><CornerDownRight className="w-3.5 h-3.5" /> Parent Task</span>
                      <div className="col-span-2 relative">
                        <select 
                          value={detailParentId}
                          onChange={(e) => {
                            setDetailParentId(e.target.value);
                            handleFieldUpdate("parentId", e.target.value || null);
                          }}
                          className="input-field pr-10 w-full bg-white cursor-pointer appearance-none !py-2"
                        >
                          <option value="">None (Root Task)</option>
                          {tasks?.filter((t: any) => t.id !== taskDetail.id && !t.parentId && (!projectIdParam || t.projectId === projectIdParam)).map((t: any) => (
                            <option key={t.id} value={t.id}>{t.title}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>

                    {/* Template Blueprint (If exists) */}
                    {taskDetail?.templateId && (
                      <div className="grid grid-cols-3 items-center gap-4 border-t border-slate-100/60 pt-3">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Template
                        </span>
                        <div className="col-span-2 flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-700 bg-amber-50 border border-amber-200/60 px-2.5 py-1 rounded-lg">
                            {taskDetail?.template?.templateName || "Blueprint"}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const matchingTemplate = templates?.find(t => t.id === taskDetail.templateId);
                              if (matchingTemplate) {
                                handleEditTemplateStart(matchingTemplate);
                              } else {
                                alert("Template blueprint not found or has been deleted.");
                              }
                            }}
                            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all shadow-sm text-[10px] font-bold cursor-pointer"
                            title="Edit original template blueprint"
                          >
                            <Edit className="w-3.5 h-3.5 text-slate-500" />
                            <span>Edit Template</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Audit Logs Row */}
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-300" />
                      <span>Created: {taskDetail?.createdAt ? new Date(taskDetail.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : "-"}</span>
                    </div>
                    {taskDetail?.updatedAt && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-300" />
                        <span>Updated: {new Date(taskDetail.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    )}
                    {taskDetail?.updatedBy && (
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-300" />
                        <span>By: <span className="text-slate-600 font-extrabold">{taskDetail.updatedBy.fullName}</span></span>
                      </div>
                    )}
                  </div>

                  {/* Description Section */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Task Description</label>
                    <textarea 
                      id="task-detail-desc"
                      placeholder="Add detailed task instructions or description..."
                      value={detailDesc}
                      onChange={(e) => setNewDetailDesc(e.target.value)}
                      onBlur={() => handleFieldUpdate("description", detailDesc)}
                      className="input-field w-full min-h-[100px] bg-slate-50/50 focus:bg-white resize-none font-medium leading-relaxed"
                    />
                  </div>

                  {/* Subtasks Notion Checklist */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Subtasks Checklist</label>
                      {taskDetail?.checklist && taskDetail.checklist.length > 0 && (
                        <span className="text-[9px] font-extrabold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          {taskDetail.checklist.filter((item: any) => item.isDone).length}/{taskDetail.checklist.length} Completed
                        </span>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      {detailChecklist?.map((item: any) => (
                        <div key={item.id} className="flex items-center gap-3 group/item bg-slate-50/50 hover:bg-slate-50 border border-slate-100/50 p-2.5 rounded-xl transition-all">
                          <button 
                            type="button"
                            onClick={() => handleToggleChecklistItem(item.id, !item.isDone)}
                            className="shrink-0 transition-transform active:scale-95"
                          >
                            {item.isDone ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-50" />
                            ) : (
                              <div className="w-4 h-4 border border-slate-300 rounded hover:border-blue-500" />
                            )}
                          </button>
                          
                          <input 
                            id={`checklist-input-${item.id}`}
                            type="text"
                            value={item.text}
                            placeholder="Type checklist item..."
                            onChange={(e) => handleUpdateChecklistItemLocal(item.id, e.target.value)}
                            onBlur={() => handleFieldUpdate("checklist", detailChecklist)}
                            className={cn(
                              "flex-1 bg-transparent text-[11px] font-medium focus:outline-none border-none",
                              item.isDone && "line-through text-slate-400"
                            )}
                          />
                          
                          <button 
                            type="button"
                            onClick={() => handleDeleteChecklistItem(item.id)}
                            className="opacity-0 group-hover/item:opacity-100 p-1 hover:bg-red-50 hover:text-red-500 rounded-lg text-slate-300 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      
                      <button 
                        type="button"
                        onClick={handleAddChecklistItem}
                        className="w-full text-left p-2.5 bg-slate-50/30 hover:bg-slate-50/70 border border-dashed border-slate-200 hover:border-slate-300 rounded-xl text-[10px] font-bold text-slate-500 hover:text-slate-800 transition-all flex items-center justify-center gap-2"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add checklist item
                      </button>
                    </div>
                  </div>

                  {/* Sub-tasks Hierarchy */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Sub-tasks Hierarchy</label>
                      {tasks && taskDetail && (
                        <span className="text-[9px] font-extrabold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          {tasks.filter((t: any) => t.parentId === taskDetail.id).length} Sub-tasks
                        </span>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      {tasks?.filter((t: any) => t.parentId === taskDetail.id).map((subtask: any) => {
                        const statusObj = STATUSES.find(s => s.id === subtask.status);
                        const priorityObj = PRIORITIES.find(p => p.id === subtask.priority);
                        return (
                          <div 
                            key={subtask.id} 
                            onClick={() => setSelectedTask(subtask)}
                            className="flex items-center justify-between gap-3 bg-slate-50/50 hover:bg-slate-100 border border-slate-100/50 p-2.5 rounded-xl transition-all cursor-pointer group/sub"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <CornerDownRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className={cn("text-[11px] font-bold text-slate-800 truncate", subtask.status === "DONE" && "line-through text-slate-400")}>
                                {subtask.title}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-2 shrink-0">
                              {statusObj && (
                                <span className={cn("px-1.5 py-0.5 rounded-md text-[8px] font-extrabold uppercase border tracking-tight", statusObj.color)}>
                                  {statusObj.label}
                                </span>
                              )}
                              {priorityObj && (
                                <span className={cn("px-1.5 py-0.5 rounded-md text-[8px] font-extrabold uppercase border tracking-tight", priorityObj.color)}>
                                  {priorityObj.label}
                                </span>
                              )}
                              
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm("Are you sure you want to delete this sub-task?")) {
                                    deleteTaskMutation.mutate(subtask.id);
                                  }
                                }}
                                className="opacity-0 group-hover/sub:opacity-100 p-1 hover:bg-red-50 hover:text-red-500 rounded-lg text-slate-350 transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {/* Quick inline subtask creator */}
                      {taskDetail && (
                        <form 
                          onSubmit={(e: any) => {
                            e.preventDefault();
                            const val = e.target.elements.subtaskTitle.value.trim();
                            if (!val) return;
                            createTaskMutation.mutate({
                              title: val,
                              status: "NOT_STARTED",
                              priority: "MEDIUM",
                              taskType: "TASK",
                              projectId: taskDetail.projectId || undefined,
                              parentId: taskDetail.id
                            });
                            e.target.reset();
                          }}
                          className="flex gap-2"
                        >
                          <input
                            type="text"
                            name="subtaskTitle"
                            placeholder="Add a new sub-task..."
                            className="input-field flex-1 text-[11px] font-medium !py-2 bg-slate-50/30 focus:bg-white"
                          />
                          <button
                            type="submit"
                            className="btn-primary py-2 px-4 rounded-xl text-[10px] font-bold transition-all shrink-0"
                          >
                            Add
                          </button>
                        </form>
                      )}
                    </div>
                  </div>

                  {/* File Attachments */}
                  <div className="space-y-3 pt-2">
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">File Attachments</label>
                    
                    {/* Upload Field */}
                    <div className="relative">
                      <input 
                        type="file"
                        multiple
                        id="task-file-upload"
                        className="hidden"
                        onChange={async (e) => {
                          if (!selectedTask?.id || !e.target.files) return;
                          setIsUploading(true);
                          try {
                            const files = Array.from(e.target.files);
                            const uploadPromises = files.map((file) => {
                              return new Promise((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onloadend = async () => {
                                  try {
                                    await uploadAttachmentMutation.mutateAsync({
                                      taskId: selectedTask.id,
                                      filename: file.name,
                                      base64Data: reader.result as string
                                    });
                                    resolve();
                                  } catch (err) {
                                    reject(err);
                                  }
                                };
                                reader.onerror = () => reject(reader.error);
                                reader.readAsDataURL(file);
                              });
                            });
                            await Promise.all(uploadPromises);
                          } catch (err) {
                            console.error("Upload error", err);
                          } finally {
                            setIsUploading(false);
                          }
                        }}
                      />
                      <label 
                        htmlFor="task-file-upload"
                        className="w-full h-24 border border-dashed border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 rounded-2xl cursor-pointer flex flex-col items-center justify-center gap-2 transition-all p-4 group"
                      >
                        {isUploading ? (
                          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                        ) : (
                          <Paperclip className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                        )}
                        <span className="text-[10px] font-bold text-slate-500 group-hover:text-slate-800">
                          {isUploading ? "Uploading file packages..." : "Click or Drag files to attach"}
                        </span>
                      </label>
                    </div>

                    {/* Attachments List */}
                    {taskDetail?.attachments && taskDetail.attachments.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {taskDetail.attachments.map((file: any) => {
                          const isImg = isImageFile(file.filename, file.mimeType);
                          const fileUrl = getFileUrl(file);
                          return (
                            <div key={file.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between gap-3 group/file hover:bg-slate-100/50 transition-all">
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                {isImg ? (
                                  <div 
                                    className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0 bg-white flex items-center justify-center cursor-pointer"
                                    onClick={() => setPreviewImage(fileUrl)}
                                  >
                                    <img src={fileUrl} alt={file.filename} className="w-full h-full object-cover" />
                                  </div>
                                ) : (
                                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 flex-shrink-0">
                                    <Paperclip className="w-4 h-4" />
                                  </div>
                                )}
                                <a 
                                  href={fileUrl}
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="min-w-0 flex-1 hover:text-blue-600 transition-colors"
                                >
                                  <div className="min-w-0">
                                    <p className="text-[10px] font-bold text-slate-800 truncate mb-0" title={file.filename}>{file.filename}</p>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                                      {(file.size / 1024).toFixed(1)} KB • {file.driver}
                                    </span>
                                  </div>
                                </a>
                              </div>
                              <button 
                                type="button"
                                onClick={() => {
                                  if (confirm(`Remove file "${file.filename}"?`)) {
                                    deleteAttachmentMutation.mutate(file.id);
                                  }
                                }}
                                className="p-1 hover:bg-red-50 hover:text-red-500 rounded-lg text-slate-300 opacity-0 group-hover/file:opacity-100 transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Comments Thread Section */}
                  <div className="border-t border-slate-100 pt-6 space-y-5">
                    <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-0">
                      <MessageSquare className="w-4 h-4 text-blue-500" /> Collaboration Thread ({taskDetail?.comments?.length || 0})
                    </h4>

                    {/* Comments Feed */}
                    <div className="space-y-3.5">
                      {taskDetail?.comments?.filter((c: any) => !c.parentId).map((comment: any) => (
                        <div key={comment.id} className="p-4 bg-slate-50 border border-slate-100/50 rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-extrabold text-slate-900 flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-[8px] font-black flex items-center justify-center border border-blue-200">
                                {comment.author.fullName.charAt(0).toUpperCase()}
                              </div>
                              {comment.author.fullName}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">
                              {new Date(comment.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 leading-relaxed pl-7 font-medium mb-0">{comment.content}</p>
                          
                           {/* Comment Attachments */}
                          {comment.attachments && comment.attachments.length > 0 && (
                            <div className="pl-7 pt-2 flex flex-wrap gap-3">
                              {comment.attachments.map((file: any) => {
                                const isImg = isImageFile(file.filename, file.mimeType);
                                const fileUrl = getFileUrl(file);
                                return isImg ? (
                                  <div 
                                    key={file.id} 
                                    className="relative group cursor-pointer w-24 h-24 rounded-xl overflow-hidden border border-slate-200/60 bg-white"
                                    onClick={() => setPreviewImage(fileUrl)}
                                  >
                                    <img src={fileUrl} alt={file.filename} className="w-full h-full object-cover transition-all group-hover:scale-105" />
                                    <div className="absolute inset-0 bg-slate-900/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <Maximize2 className="w-4 h-4 text-white drop-shadow-sm" />
                                    </div>
                                  </div>
                                ) : (
                                  <a 
                                    key={file.id}
                                    href={fileUrl}
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-100 rounded-lg text-[9px] font-bold text-slate-700 hover:text-blue-600 hover:bg-slate-50 transition-all shadow-sm h-fit"
                                  >
                                    <Paperclip className="w-3 h-3 text-slate-400" />
                                    <span>{file.filename}</span>
                                    <span className="text-slate-300">•</span>
                                    <span className="text-[8px] text-slate-400 font-normal">{(file.size / 1024).toFixed(1)} KB</span>
                                  </a>
                                );
                              })}
                            </div>
                          )}

                          {/* Thread Reply trigger */}
                          <div className="flex items-center gap-3">
                            <button 
                              type="button"
                              onClick={() => {
                                setReplyToId(comment.id);
                                setReplyToUser(comment.author.fullName);
                                setNewCommentText(`@${comment.author.username || comment.author.fullName.replace(/\s+/g, '')} `);
                              }}
                              className="text-[9px] font-extrabold text-slate-400 hover:text-blue-600 uppercase flex items-center gap-1 mt-1 pl-7 transition-colors"
                            >
                              <CornerDownRight className="w-3.5 h-3.5" /> Reply
                            </button>
                          </div>

                          {/* Render Nested Replies */}
                          {taskDetail?.comments?.filter((r: any) => r.parentId === comment.id).map((reply: any) => (
                            <div key={reply.id} className="pl-6 mt-3 border-l-2 border-slate-200 ml-4 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-extrabold text-slate-900 flex items-center gap-2">
                                  <div className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 text-[8px] font-black flex items-center justify-center border border-slate-300">
                                    {reply.author.fullName.charAt(0).toUpperCase()}
                                  </div>
                                  {reply.author.fullName}
                                </span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase">
                                  {new Date(reply.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-600 leading-relaxed pl-6 font-medium mb-0">{reply.content}</p>
                              
                              {/* Reply Attachments */}
                              {reply.attachments && reply.attachments.length > 0 && (
                                <div className="pl-6 pt-2 flex flex-wrap gap-2">
                                  {reply.attachments.map((file: any) => {
                                    const isImg = isImageFile(file.filename, file.mimeType);
                                    const fileUrl = getFileUrl(file);
                                    return isImg ? (
                                      <div 
                                        key={file.id} 
                                        className="relative group cursor-pointer w-16 h-16 rounded-lg overflow-hidden border border-slate-200/60 bg-white"
                                        onClick={() => setPreviewImage(fileUrl)}
                                      >
                                        <img src={fileUrl} alt={file.filename} className="w-full h-full object-cover transition-all group-hover:scale-105" />
                                        <div className="absolute inset-0 bg-slate-900/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                          <Maximize2 className="w-3 h-3 text-white drop-shadow-sm" />
                                        </div>
                                      </div>
                                    ) : (
                                      <a 
                                        key={file.id}
                                        href={fileUrl}
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-100 rounded-lg text-[9px] font-bold text-slate-700 hover:text-blue-600 hover:bg-slate-50 transition-all shadow-sm h-fit"
                                      >
                                        <Paperclip className="w-3 h-3 text-slate-400" />
                                        <span>{file.filename}</span>
                                        <span className="text-slate-300">•</span>
                                        <span className="text-[8px] text-slate-400 font-normal">{(file.size / 1024).toFixed(1)} KB</span>
                                      </a>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Sub-Reply trigger */}
                              <div className="flex items-center gap-3">
                                <button 
                                  type="button"
                                  onClick={() => {
                                    setReplyToId(comment.id);
                                    setReplyToUser(reply.author.fullName);
                                    setNewCommentText(`@${reply.author.username || reply.author.fullName.replace(/\s+/g, '')} `);
                                  }}
                                  className="text-[9px] font-extrabold text-slate-400 hover:text-blue-600 uppercase flex items-center gap-1 mt-1 pl-6 transition-colors"
                                >
                                  <CornerDownRight className="w-3.5 h-3.5" /> Reply
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}

                      {(!taskDetail?.comments || taskDetail.comments.length === 0) && (
                        <div className="p-6 text-center border border-dashed border-slate-100 rounded-xl bg-slate-50/30">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">No cooperation notes yet</span>
                        </div>
                      )}
                    </div>

                    {/* Add Comment Input */}
                    <form onSubmit={handleCommentSubmit} className="space-y-3 pt-2">
                      {replyToId && (
                        <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-4 py-2 text-[10px] font-bold text-blue-700">
                          <span>Replying to {replyToUser}</span>
                          <button 
                            type="button" 
                            onClick={() => {
                              setReplyToId(null);
                              setReplyToUser(null);
                            }}
                            className="text-slate-400 hover:text-red-500 text-xs font-bold font-mono"
                          >
                            ×
                          </button>
                        </div>
                      )}
                      
                      {/* Upload files pending comment submission */}
                      {commentAttachments.length > 0 && (
                        <div className="flex flex-wrap gap-2.5 pb-2.5">
                          {commentAttachments.map((file, idx) => {
                            const isImg = isImageFile(file.filename);
                            return isImg ? (
                              <div key={idx} className="relative group w-14 h-14 rounded-xl overflow-hidden border border-blue-100 bg-white flex items-center justify-center shadow-sm transition-all animate-fade-in">
                                <img 
                                  src={file.base64Data} 
                                  alt={file.filename} 
                                  className="w-full h-full object-cover cursor-zoom-in hover:opacity-90 transition-opacity" 
                                  onClick={() => setPreviewImage(file.base64Data)}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCommentAttachments(prev => prev.filter((_, i) => i !== idx));
                                  }}
                                  className="absolute top-1 right-1 p-0.5 bg-black/60 hover:bg-red-600 text-white rounded-full transition-colors"
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            ) : (
                              <div key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50/70 border border-blue-100 rounded-xl text-[9px] font-bold text-blue-700 shadow-sm transition-all animate-fade-in">
                                <Paperclip className="w-3 h-3 text-blue-500" />
                                <span className="truncate max-w-[120px]">{file.filename}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCommentAttachments(prev => prev.filter((_, i) => i !== idx));
                                  }}
                                  className="text-blue-400 hover:text-red-500 font-extrabold ml-1 hover:scale-110 transition-transform"
                                >
                                  ×
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="flex gap-3 items-end">
                        <div className="flex-1 relative flex items-center bg-slate-50/50 hover:bg-slate-50/80 focus-within:bg-white border border-slate-200/70 focus-within:border-blue-400 rounded-2xl p-1.5 transition-all shadow-sm focus-within:shadow-md">
                          <textarea 
                            ref={textareaRef}
                            placeholder={replyToId ? "Write a reply and attach files..." : "Write a cooperative comment..."}
                            value={newCommentText}
                            onChange={(e) => handleCommentChange(e.target.value, e.target.selectionStart)}
                            onKeyDown={handleKeyDown}
                            onPaste={async (e) => {
                              const clipboardItems = e.clipboardData?.items;
                              if (!clipboardItems) return;
                              for (let i = 0; i < clipboardItems.length; i++) {
                                const item = clipboardItems[i];
                                if (item.type.startsWith("image/")) {
                                  e.preventDefault(); // Prevent pasting raw text/image bytes in textarea text
                                  const file = item.getAsFile();
                                  if (!file) continue;
                                  
                                  // Limit to 10MB
                                  if (file.size > 10 * 1024 * 1024) {
                                    alert("File is too large. Max 10MB.");
                                    return;
                                  }
                                  
                                  // Create filename with timestamp
                                  const ext = file.type.split("/")[1] || "png";
                                  const filename = `screenshot_${Date.now()}.${ext}`;
                                  
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    setCommentAttachments(prev => [
                                      ...prev,
                                      { filename, base64Data: reader.result as string }
                                    ]);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }
                            }}
                            className="w-full min-h-[100px] max-h-[220px] bg-transparent border-none outline-none focus:ring-0 resize-none font-medium text-[11px] leading-relaxed py-1.5 px-2 text-slate-700"
                          />
                          
                          {/* Premium Mentions Autocomplete Dropdown */}
                          {showMentionDropdown && filteredMentionUsers.length > 0 && (
                            <div className="absolute bottom-full left-0 mb-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-[250] max-h-56 overflow-y-auto custom-scrollbar space-y-0.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
                              <div className="px-3 py-1.5 border-b border-slate-50 flex items-center justify-between">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Mention User</span>
                                <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md">
                                  {filteredMentionUsers.length} found
                                </span>
                              </div>
                              {filteredMentionUsers.map((user: any, index: number) => (
                                <button
                                  key={user.id}
                                  type="button"
                                  onClick={() => insertMention(user)}
                                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left ${
                                    index === activeMentionIndex 
                                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/10" 
                                      : "hover:bg-slate-50 text-slate-700"
                                  }`}
                                  onMouseEnter={() => setActiveMentionIndex(index)}
                                >
                                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors ${
                                    index === activeMentionIndex
                                      ? "bg-white/20 text-white"
                                      : "bg-blue-50 text-blue-600"
                                  }`}>
                                    {user.fullName.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="flex flex-col min-w-0">
                                    <span className={`text-[11px] font-bold truncate ${
                                      index === activeMentionIndex ? "text-white" : "text-slate-700"
                                    }`}>
                                      {user.fullName}
                                    </span>
                                    <span className={`text-[9px] truncate font-medium ${
                                      index === activeMentionIndex ? "text-white/70" : "text-slate-400"
                                    }`}>
                                      @{user.username || user.fullName.replace(/\s+/g, '').toLowerCase()}
                                    </span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                          
                          <input 
                            type="file"
                            multiple
                            id="comment-file-upload"
                            className="hidden"
                            onChange={(e) => {
                              if (!e.target.files) return;
                              for (let i = 0; i < e.target.files.length; i++) {
                                const file = e.target.files[i];
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setCommentAttachments(prev => [
                                    ...prev,
                                    { filename: file.name, base64Data: reader.result as string }
                                  ]);
                                };
                                reader.readAsDataURL(file);
                              }
                              e.target.value = ""; // Reset file input selection
                            }}
                          />
                          <label 
                            htmlFor="comment-file-upload"
                            className="p-2 hover:bg-slate-200/50 rounded-xl cursor-pointer text-slate-400 hover:text-slate-700 transition-all mr-1 self-end active:scale-95"
                            title="Attach File to Comment"
                          >
                            <Paperclip className="w-4 h-4" />
                          </label>
                        </div>

                        <button 
                          type="submit" 
                          disabled={!newCommentText.trim() || addCommentMutation.isPending}
                          className="btn-primary !p-3.5 rounded-2xl shrink-0 flex items-center justify-center hover:-translate-y-0 active:scale-95 self-end"
                        >
                          {addCommentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Image Preview Lightbox */}
        <AnimatePresence>
          {previewImage && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-8 bg-slate-900/90 backdrop-blur-md" onClick={() => setPreviewImage(null)}>
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative max-w-7xl max-h-full">
                <img src={previewImage} className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl border border-white/10" onClick={(e) => e.stopPropagation()} />
                <button onClick={() => setPreviewImage(null)} className="absolute -top-12 right-0 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all">
                  <X className="w-6 h-6" />
                </button>
                <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex gap-4">
                  <a 
                    href={previewImage} 
                    download="download" 
                    className="px-6 py-2 bg-white text-slate-900 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 shadow-xl hover:bg-slate-100 transition-all" 
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Download className="w-4 h-4" /> Download Original
                  </a>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ==================== CREATE PROJECT MODAL ==================== */}
        <AnimatePresence>
          {isCreateProjectOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl w-full max-w-md border border-slate-100 shadow-2xl overflow-hidden animate-none"
              >
                <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600 animate-none" />
                    <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Create New Tracker Workspace</span>
                  </div>
                  <button 
                    onClick={() => setIsCreateProjectOpen(false)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-900 transition-all cursor-pointer animate-none"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleCreateProjectSubmit} className="p-6 space-y-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Workspace Name</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Task Activity" 
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      className="input-field w-full"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Description</label>
                    <textarea 
                      placeholder="e.g. Activities and milestones for task management" 
                      value={newProjectDesc}
                      onChange={(e) => setNewProjectDesc(e.target.value)}
                      className="input-field w-full min-h-[80px] resize-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Theme Color</label>
                    <div className="flex items-center gap-2 mt-1">
                      {["#4F46E5", "#06B6D4", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#8B5CF6", "#64748B"].map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNewProjectColor(c)}
                          className={cn(
                            "w-7 h-7 rounded-full transition-transform active:scale-90 border-2 animate-none",
                            newProjectColor === c ? "border-slate-800 scale-110 shadow-sm" : "border-transparent"
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                    <button 
                      type="button" 
                      onClick={() => setIsCreateProjectOpen(false)}
                      className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all animate-none"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      disabled={createProjectMutation.isPending}
                      className="btn-primary flex items-center gap-1.5 py-2 px-4 rounded-xl text-xs font-bold transition-all duration-200 active:scale-95 animate-none"
                    >
                      {createProjectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : "Create Workspace"}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ==================== EDIT PROJECT MODAL ==================== */}
        <AnimatePresence>
          {isEditProjectOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl w-full max-w-md border border-slate-100 shadow-2xl overflow-hidden animate-none"
              >
                <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600 animate-none" />
                    <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Edit Tracker Workspace</span>
                  </div>
                  <button 
                    onClick={() => setIsEditProjectOpen(false)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-900 transition-all cursor-pointer animate-none"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleUpdateProjectSubmit} className="p-6 space-y-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Workspace Name</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Task Activity" 
                      value={editProjectName}
                      onChange={(e) => setEditProjectName(e.target.value)}
                      className="input-field w-full"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Description</label>
                    <textarea 
                      placeholder="e.g. Activities and milestones for task management" 
                      value={editProjectDesc}
                      onChange={(e) => setEditProjectDesc(e.target.value)}
                      className="input-field w-full min-h-[80px] resize-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Theme Color</label>
                    <div className="flex items-center gap-2 mt-1">
                      {["#4F46E5", "#06B6D4", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#8B5CF6", "#64748B"].map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setEditProjectColor(c)}
                          className={cn(
                            "w-7 h-7 rounded-full transition-transform active:scale-90 border-2 animate-none",
                            editProjectColor === c ? "border-slate-800 scale-110 shadow-sm" : "border-transparent"
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                    <button 
                      type="button" 
                      onClick={() => setIsEditProjectOpen(false)}
                      className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all animate-none"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      disabled={updateProjectMutation.isPending}
                      className="btn-primary flex items-center gap-1.5 py-2 px-4 rounded-xl text-xs font-bold transition-all duration-200 active:scale-95 animate-none"
                    >
                      {updateProjectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : "Save Changes"}
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

export default function TasksPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-slate-50 font-sans">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading task workspace...</p>
        </div>
      </div>
    }>
      <TasksPageContent />
    </Suspense>
  );
}
