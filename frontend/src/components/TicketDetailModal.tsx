"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  X, 
  Send, 
  User as UserIcon, 
  Clock, 
  ShieldCheck, 
  MessageSquare,
  Loader2,
  Monitor,
  Zap,
  Globe,
  Database,
  Cpu,
  HardDrive,
  Users,
  Image as ImageIcon,
  Paperclip,
  Plus,
  Trash2,
  Settings,
  LifeBuoy,
  Tag,
  Layers,
  ExternalLink,
  Edit2,
  Download,
  Share2,
  ShieldAlert,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  AtSign
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/hooks/useIsAdmin";

interface Comment {
  id: string;
  content: string;
  attachment?: string;
  authorId: string;
  author: { 
    fullName: string; 
    username?: string;
    roles?: { role: { name: string } }[];
  };
  createdAt: string;
  parentId?: string;
  replies?: Comment[];
}


interface TicketDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: {
    id: string;
    ticketId: string;
    type: 'VM' | 'SERVICE' | 'SUPPORT';
    title: string;
    status: string;
    environment?: string;
    createdAt: string;
    requestedBy?: string;
    actionedBy?: string;
    followers?: { id: string, fullName: string }[];
    category?: string;
    tags?: string[];
    attachments?: string[];
    priority?: string;
    notes?: string;
    description?: string;
  };
  isAdmin?: boolean;
  onApprove?: (ticket: any) => void;
  onReject?: (ticket: any) => void;
}

export function TicketDetailModal({ isOpen, onClose, ticket, isAdmin = false, onApprove, onReject }: TicketDetailModalProps) {
  const queryClient = useQueryClient();
  const { profile } = useIsAdmin();
  const [editingCommentId, setEditingCommentId] = useState(null as string | null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [commentText, setCommentText] = useState("");
  const [attachment, setAttachment] = useState(null as string | null);

  const sanitizeDataUrl = (url: string | undefined | null) => {
    if (!url) return "";
    return url.replace(/;name=[^;,\s]+/i, '');
  };

  const getAttachmentFilename = (dataUrl: string | undefined | null) => {
    if (!dataUrl) return "download";
    const match = dataUrl.match(/;name=([^;,\s]+)/i);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
    const mimeMatch = dataUrl.match(/^data:([^;]+)/);
    if (mimeMatch && mimeMatch[1]) {
      const mime = mimeMatch[1];
      const ext = mime.split('/')[1];
      if (ext) return `attachment.${ext}`;
    }
    return "download";
  };

  const isImageAttachment = (at: string | undefined | null) => {
    if (!at) return false;
    if (at.startsWith('data:image/')) return true;
    if (at.startsWith('http://') || at.startsWith('https://') || at.startsWith('/')) {
      const cleanUrl = at.split('?')[0];
      const ext = cleanUrl.split('.').pop()?.toLowerCase();
      return ext ? ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext) : false;
    }
    const filename = getAttachmentFilename(at);
    const ext = filename.split('.').pop()?.toLowerCase();
    return ext ? ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext) : false;
  };

  const [showFollowerPanel, setShowFollowerPanel] = useState(false);
  const [replyTo, setReplyTo] = useState(null as Comment | null);
  const [previewImage, setPreviewImage] = useState(null as string | null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commentScrollRef = useRef<HTMLDivElement>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mentionSearch, setMentionSearch] = useState("");
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [editData, setEditData] = useState({ 
    title: "", 
    description: "",
    cpu: 0,
    ram: 0,
    disk: 0,
    environment: "",
    priority: "",
    status: "",
    osTemplate: "",
    attachments: [] as string[]
  });

  const { data: comments, isLoading: isLoadingComments } = useQuery({
    queryKey: ["ticket-comments", ticket.id],
    queryFn: async () => {
      const response = await api.get(`/ticket-comments/${ticket.id}?type=${ticket.type}`);
      return response.data;
    },
    enabled: isOpen
  });

  const { data: osTemplates } = useQuery({
    queryKey: ["catalog", "OS_TEMPLATE"],
    queryFn: async () => {
      const response = await api.get("/catalog?category=OS_TEMPLATE");
      return response.data;
    },
    enabled: isOpen && ticket.type === 'VM'
  });

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const response = await api.get("/users");
      return response.data;
    },
    enabled: isOpen
  });

  const [isCopied, setIsCopied] = useState(false);

  const { data: currentTicket, isLoading: isLoadingTicket, error: ticketError } = useQuery({
    queryKey: ["ticket-detail", ticket.id],
    queryFn: async () => {
      const basePath = ticket.type === 'SUPPORT' ? 'support-tickets' : `${ticket.type.toLowerCase()}/request`;
      const response = await api.get(`/${basePath}/${ticket.id}`);
      return response.data;
    },
    enabled: isOpen,
    retry: false
  });

  const isUnauthorized = (ticketError as any)?.response?.status === 403;

  const filteredMentionUsers = users?.filter((u: any) => {
    const searchStr = mentionSearch.toLowerCase();
    const fullNameMatches = u.fullName?.toLowerCase().includes(searchStr);
    const usernameMatches = u.username?.toLowerCase().includes(searchStr);
    return fullNameMatches || usernameMatches;
  }) || [];

  const handleCommentChange = (text: string, selectionStart: number) => {
    setCommentText(text);

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
    
    const beforeMention = commentText.substring(0, mentionStartIndex);
    const afterMention = commentText.substring(mentionStartIndex + mentionSearch.length + 1);
    
    const newText = beforeMention + tagText + " " + afterMention;
    setCommentText(newText);
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

  const handleShare = () => {
    const url = `${window.location.origin}/tickets?id=${ticket.id}&type=${ticket.type}`;
    navigator.clipboard.writeText(url);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const displayTicket = currentTicket || ticket;

  const commentMutation = useMutation({
    mutationFn: async (data: { content: string; attachment?: string; parentId?: string }) => {
      const response = await api.post("/ticket-comments", {
        ...data,
        [ticket.type === 'VM' ? 'vmRequestId' : 
         ticket.type === 'SERVICE' ? 'serviceRequestId' : 
         'supportTicketId']: ticket.id
      });
      return response.data;
    },
    onSuccess: () => {
      setCommentText("");
      setAttachment(null);
      setReplyTo(null);
      queryClient.invalidateQueries({ queryKey: ["ticket-comments", ticket.id] });
      setTimeout(() => {
        commentScrollRef.current?.scrollTo({ top: commentScrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 100);
    }
  });

  const editCommentMutation = useMutation({
    mutationFn: async (data: { commentId: string; content: string }) => {
      const response = await api.patch(`/ticket-comments/${data.commentId}`, {
        content: data.content,
      });
      return response.data;
    },
    onSuccess: () => {
      setEditingCommentId(null);
      setEditingCommentText("");
      queryClient.invalidateQueries({ queryKey: ["ticket-comments", ticket.id] });
    }
  });

  const addFollowerMutation = useMutation({
    mutationFn: (userId: string) => {
      const basePath = ticket.type === 'SUPPORT' ? 'support-tickets' : `${ticket.type.toLowerCase()}/request`;
      return api.post(`/${basePath}/${ticket.id}/followers`, { userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-detail", ticket.id] });
      queryClient.invalidateQueries({ queryKey: ["vm-requests"] });
      queryClient.invalidateQueries({ queryKey: ["service-requests"] });
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["ticket-comments", ticket.id] });
    }
  });

  const removeFollowerMutation = useMutation({
    mutationFn: (userId: string) => {
      const basePath = ticket.type === 'SUPPORT' ? 'support-tickets' : `${ticket.type.toLowerCase()}/request`;
      return api.delete(`/${basePath}/${ticket.id}/followers/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-detail", ticket.id] });
      queryClient.invalidateQueries({ queryKey: ["vm-requests"] });
      queryClient.invalidateQueries({ queryKey: ["service-requests"] });
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["ticket-comments", ticket.id] });
    }
  });

   const updateTicketMutation = useMutation({
    mutationFn: async (data: typeof editData) => {
      const basePath = ticket.type === 'SUPPORT' ? 'support-tickets' : `${ticket.type.toLowerCase()}/request`;
      const payload: any = {
        status: data.status
      };
      if (ticket.type === 'SUPPORT') {
        payload.subject = data.title;
        payload.description = data.description;
        payload.priority = data.priority;
        if (data.attachments?.length > 0) payload.attachments = data.attachments;
      } else if (ticket.type === 'VM') {
        payload.hostname = data.title;
        payload.notes = data.description;
        payload.cpu = data.cpu;
        payload.ram = data.ram;
        payload.disk = data.disk;
        payload.environment = data.environment;
        payload.osTemplate = data.osTemplate;
      } else {
        payload.serviceName = data.title;
        payload.notes = data.description;
        payload.environment = data.environment;
      }
      return api.put(`/${basePath}/${ticket.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-detail", ticket.id] });
      queryClient.invalidateQueries({ queryKey: ["vm-requests"] });
      queryClient.invalidateQueries({ queryKey: ["service-requests"] });
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      setIsEditing(false);
    }
  });

  useEffect(() => {
    if (isEditing && displayTicket) {
      const activeId = typeof document !== 'undefined' ? document.activeElement?.id : null;
      setEditData(prev => {
        const currentTitle = (activeId === "ticket-edit-title" && prev) 
          ? prev.title 
          : (displayTicket.title || displayTicket.hostname || displayTicket.serviceName || displayTicket.subject || "");
        const currentDesc = (activeId === "ticket-edit-description" && prev) 
          ? prev.description 
          : (displayTicket.notes || displayTicket.description || "");
        
        return {
          title: currentTitle,
          description: currentDesc,
          cpu: displayTicket.cpu || 0,
          ram: displayTicket.ram || 0,
          disk: displayTicket.disk || 0,
          environment: displayTicket.environment || "",
          priority: displayTicket.priority || "",
          status: displayTicket.status || "",
          osTemplate: displayTicket.osTemplate || "",
          attachments: displayTicket.attachments || []
        };
      });
    }
  }, [isEditing, displayTicket]);

  const handleSendComment = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!commentText.trim() && !attachment) || commentMutation.isPending) return;
    commentMutation.mutate({ 
      content: commentText, 
      attachment: attachment || undefined,
      parentId: replyTo?.id
    });
  };

  const onFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert("File is too large. Max 10MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        let base64 = reader.result as string;
        const dataParts = base64.split(',');
        const metaParts = dataParts[0].split(';');
        const newMeta = [metaParts[0], `name=${file.name}`, ...metaParts.slice(1)].join(';');
        setAttachment(newMeta + ',' + dataParts[1]);
      };
      reader.readAsDataURL(file);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
      case 'COMPLETED':
      case 'RESOLVED': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'REJECTED':
      case 'FAILED':
      case 'CLOSED': return 'bg-rose-50 text-rose-600 border-rose-100';
      default: return 'bg-amber-50 text-amber-600 border-amber-100';
    }
  };

  const renderComment = (comment: Comment, depth = 0) => {
    const isReply = depth > 0;
    // Cap visual indentation at depth 2 to prevent excessive narrowing
    const shouldIndent = depth <= 2;
    
    return (
      <div key={comment.id} className={cn(
        "relative",
        !isReply ? "mt-8 ml-0" :
        shouldIndent ? "mt-4 ml-6 md:ml-8" : "mt-4 ml-0"
      )}>
        {/* Facebook-style L-shape connection line for replies */}
        {isReply && shouldIndent && (
          <div className="absolute -left-3 md:-left-4 top-0 w-3 md:w-4 h-6 border-l-2 border-b-2 border-slate-200 rounded-bl-xl" />
        )}
        
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-900 flex items-center gap-2 relative">
                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white shadow-sm z-10", isReply ? "bg-slate-400" : "bg-blue-600")}>
                  {comment.author.fullName.charAt(0)}
                </div>
                {comment.author.fullName}
              </span>
              {comment.author.roles?.some(r => r.role?.name && ["ADMIN", "SYSTEM ADMIN", "SYSTEM_ADMIN", "SUPERADMIN", "PRODUCTION"].includes(r.role.name.toUpperCase())) && (
                <span className="text-[8px] font-black bg-blue-600 text-white px-1.5 py-0.5 rounded tracking-tighter uppercase">Admin</span>
              )}
            </div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight flex items-center gap-1.5">
              {new Date(comment.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              {comment.updatedAt && new Date(comment.updatedAt).getTime() - new Date(comment.createdAt).getTime() > 1000 && (
                <span className="text-slate-400 italic lowercase normal-case">
                  (edited: {new Date(comment.updatedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })})
                </span>
              )}
            </span>
          </div>
      <div className="p-5 bg-white rounded-2xl rounded-tl-none border border-slate-100 shadow-sm space-y-4">
        {comment.attachment && (
          <div className="rounded-xl overflow-hidden border border-slate-50 bg-slate-50/30 p-2">
            {isImageAttachment(comment.attachment) ? (
              <div className="relative group cursor-pointer" onClick={() => setPreviewImage(comment.attachment!)}>
                <img src={sanitizeDataUrl(comment.attachment)} alt="Attachment" className="w-full object-cover max-h-80 rounded-lg transition-all group-hover:brightness-90" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-white/90 p-2 rounded-xl shadow-lg text-slate-900 flex items-center gap-2 font-bold text-[10px] uppercase">
                    <Maximize2 className="w-4 h-4" /> Preview
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                    <Paperclip className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-[11px] font-bold text-slate-900 truncate max-w-[180px]">
                      {comment.attachment.split(';').find(p => p.startsWith('name='))?.split('=')[1] || 'Attached File'}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                      {comment.attachment.split(';')[0].split(':')[1].split('/')[1]?.toUpperCase() || 'FILE'}
                    </span>
                  </div>
                </div>
                <a 
                  href={sanitizeDataUrl(comment.attachment)} 
                  download={getAttachmentFilename(comment.attachment)} 
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                  title={`Download ${getAttachmentFilename(comment.attachment)}`}
                >
                  <Download className="w-4 h-4" />
                </a>
              </div>
            )}
          </div>
        )}
        {editingCommentId === comment.id ? (
          <div className="space-y-3">
            <textarea
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-[13px] text-slate-600 outline-none focus:border-indigo-400 resize-none font-medium"
              value={editingCommentText}
              onChange={(e) => setEditingCommentText(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setEditingCommentId(null);
                  setEditingCommentText("");
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!editingCommentText.trim() || editCommentMutation.isPending}
                onClick={() => editCommentMutation.mutate({ commentId: comment.id, content: editingCommentText })}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-50"
              >
                {editCommentMutation.isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-slate-600 leading-relaxed font-medium">{comment.content}</p>
        )}
        <div className="flex justify-end items-center gap-3 pt-2 border-t border-slate-50">
          {profile?.id === comment.authorId && !editingCommentId && (
            <button 
              onClick={() => {
                setEditingCommentId(comment.id);
                setEditingCommentText(comment.content);
              }}
              className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 uppercase tracking-widest flex items-center gap-1.5"
            >
              <Edit2 className="w-3 h-3" /> Edit
            </button>
          )}
          <button 
            onClick={() => {
              setReplyTo(comment);
              setCommentText(`@${comment.author.username || comment.author.fullName.replace(/\s+/g, '')} `);
            }}
            className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-widest flex items-center gap-1.5"
          >
            <MessageSquare className="w-3 h-3" /> Reply
          </button>
        </div>
      </div>
      </div>
      {comment.replies && comment.replies.length > 0 && (
        <div className="relative">
          {/* Main vertical line for connecting multiple replies to this parent */}
          {(depth < 2) && <div className="absolute left-3 top-0 bottom-6 w-0 border-l-2 border-slate-200" />}
          <div className="pt-2">
            {comment.replies.map(reply => renderComment(reply, depth + 1))}
          </div>
        </div>
      )}
    </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className={cn(
          "fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/40 backdrop-blur-sm transition-all duration-300",
          isFullScreen ? "p-0" : "p-4"
        )}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className={cn(
              "bg-white shadow-2xl flex flex-col overflow-hidden border border-slate-200 transition-all duration-300",
              isFullScreen 
                ? "w-screen h-screen max-w-none rounded-none" 
                : "w-full max-w-6xl h-[90vh] rounded-[2.5rem]"
            )}
          >
            {/* Header */}
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-xl shadow-indigo-600/20 text-white">
                  {displayTicket.type === 'VM' ? <Monitor className="w-7 h-7" /> : 
                   displayTicket.type === 'SERVICE' ? <Zap className="w-7 h-7" /> : <LifeBuoy className="w-7 h-7" />}
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    {isEditing ? (
                      <input 
                        id="ticket-edit-title"
                        className="text-2xl font-bold text-slate-900 leading-tight bg-slate-50 border-indigo-200 focus:border-indigo-400 outline-none px-2 rounded-lg"
                        value={editData.title}
                        onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                        autoFocus
                      />
                    ) : (
                      <h3 className="text-2xl font-bold text-slate-900 leading-tight">
                        {displayTicket.title || displayTicket.hostname || displayTicket.serviceName || displayTicket.subject || 'Untitled Request'}
                      </h3>
                    )}
                    <span className={cn(
                      "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border shadow-sm",
                      getStatusColor(displayTicket.status)
                    )}>
                      {displayTicket.status}
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-2">
                    <span className="text-indigo-600 font-mono">{displayTicket.ticketId}</span>
                    <span className="text-slate-200">|</span>
                    {displayTicket.subtitle || (displayTicket.type === 'VM' ? `VM ${displayTicket.osTemplate}` : displayTicket.type === 'SERVICE' ? `Service ${displayTicket.version}` : 'Support Case')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <button 
                      onClick={() => updateTicketMutation.mutate(editData)}
                      disabled={updateTicketMutation.isPending}
                      className="px-6 py-3 bg-indigo-600 text-white rounded-2xl transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2 font-bold text-[11px] uppercase tracking-wider hover:bg-indigo-700"
                    >
                      {updateTicketMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Save Changes
                    </button>
                    <button 
                      onClick={() => setIsEditing(false)}
                      className="p-3 bg-white text-slate-400 hover:text-slate-600 rounded-2xl transition-all border border-slate-100"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </>
                ) : (
                  <>
                    {isAdmin && displayTicket.status === 'PENDING' && (
                      <>
                        {onApprove && (
                          <button 
                            onClick={() => onApprove(displayTicket)}
                            className="px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl transition-all shadow-md shadow-emerald-500/20 flex items-center gap-2 font-bold text-[11px] uppercase tracking-wider"
                          >
                            <Check className="w-4 h-4" />
                            Approve
                          </button>
                        )}
                        {onReject && (
                          <button 
                            onClick={() => onReject(displayTicket)}
                            className="px-4 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl transition-all shadow-md shadow-rose-500/20 flex items-center gap-2 font-bold text-[11px] uppercase tracking-wider"
                          >
                            <X className="w-4 h-4" />
                            Reject
                          </button>
                        )}
                      </>
                    )}
                    <button 
                      onClick={() => setIsEditing(true)}
                      className="p-3 bg-white text-slate-600 hover:text-indigo-600 rounded-2xl transition-all shadow-sm flex items-center gap-2 font-bold text-[11px] uppercase tracking-wider border border-transparent hover:border-indigo-100"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit Ticket
                    </button>
                  </>
                )}
                <button 
                  onClick={handleShare}
                  className={cn(
                    "p-3 rounded-2xl transition-all shadow-sm flex items-center gap-2 font-bold text-[11px] uppercase tracking-wider",
                    isCopied ? "bg-emerald-500 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {isCopied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4 text-indigo-600" />}
                  {isCopied ? 'Copied' : 'Share URL'}
                </button>
                <button 
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  className="p-3 bg-white text-slate-400 hover:text-indigo-600 rounded-2xl transition-all shadow-sm border border-transparent hover:border-indigo-100"
                  title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
                >
                  {isFullScreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                </button>
                <button onClick={onClose} className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm">
                  <X className="w-7 h-7 text-slate-300" />
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden flex">
              {isLoadingTicket ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Decrypting Secure Ticket Data...</p>
                  </div>
                </div>
              ) : isUnauthorized ? (
                <div className="flex-1 flex items-center justify-center p-12 bg-slate-50/10">
                  <div className="max-w-md w-full text-center space-y-6">
                    <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center text-rose-500 mx-auto shadow-inner">
                      <ShieldAlert className="w-10 h-10" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold text-slate-900">Access Denied</h3>
                      <p className="text-slate-500 text-sm leading-relaxed">
                        You do not have permission to view this ticket. Only the requestor, assigned administrators, and followers can access these records.
                      </p>
                    </div>
                    <div className="pt-4">
                      <button onClick={onClose} className="px-8 py-3.5 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-xl hover:bg-slate-800 transition-all uppercase tracking-widest">
                        Return to Workspace
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Left Column: Info & Details */}
                  <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar bg-slate-50/10 border-r border-slate-50">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5" /> Created At
                        </p>
                        <p className="text-[13px] font-bold text-slate-700">{new Date(displayTicket.createdAt).toLocaleString()}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5" /> Last Updated
                        </p>
                        <p className="text-[13px] font-bold text-slate-700">{new Date(displayTicket.updatedAt || displayTicket.createdAt).toLocaleString()}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <Globe className="w-3.5 h-3.5" /> {ticket.type === 'SUPPORT' ? 'Priority' : 'Environment'}
                        </p>
                        {isEditing ? (
                          ticket.type === 'SUPPORT' ? (
                            <select 
                              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-[13px] font-bold text-slate-700 outline-none focus:border-indigo-400 uppercase"
                              value={editData.priority}
                              onChange={(e) => setEditData({ ...editData, priority: e.target.value })}
                            >
                              <option value="LOW">LOW</option>
                              <option value="NORMAL">NORMAL</option>
                              <option value="HIGH">HIGH</option>
                              <option value="URGENT">URGENT</option>
                            </select>
                          ) : (
                            <select 
                              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-[13px] font-bold text-slate-700 outline-none focus:border-indigo-400 uppercase"
                              value={editData.environment}
                              onChange={(e) => setEditData({ ...editData, environment: e.target.value })}
                            >
                              <option value="Development">DEVELOPMENT</option>
                              <option value="Staging">STAGING</option>
                              <option value="Production">PRODUCTION</option>
                            </select>
                          )
                        ) : (
                          <p className="text-[13px] font-bold text-slate-700 uppercase">{displayTicket.environment || displayTicket.priority || 'NORMAL'}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <UserIcon className="w-3.5 h-3.5" /> Requester
                        </p>
                        <p className="text-[13px] font-bold text-slate-700">{displayTicket.user?.fullName || displayTicket.requestedBy || 'Unknown'}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <ShieldCheck className="w-3.5 h-3.5" /> Status
                        </p>
                        {isEditing ? (
                          <select 
                            disabled={!isAdmin}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-[13px] font-bold text-slate-700 outline-none focus:border-indigo-400 uppercase disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                            value={editData.status}
                            onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                          >
                            {ticket.type === 'SUPPORT' ? (
                              <>
                                <option value="OPEN">OPEN</option>
                                <option value="IN_PROGRESS">IN PROGRESS</option>
                                <option value="RESOLVED">RESOLVED</option>
                                <option value="CLOSED">CLOSED</option>
                              </>
                            ) : (
                              <>
                                <option value="PENDING">PENDING</option>
                                <option value="APPROVED">APPROVED</option>
                                <option value="PROVISIONING">PROVISIONING</option>
                                <option value="COMPLETED">COMPLETED</option>
                                <option value="FAILED">FAILED</option>
                                <option value="REJECTED">REJECTED</option>
                              </>
                            )}
                          </select>
                        ) : (
                          <span className={cn("badge inline-flex items-center px-3 py-1 text-[10px] font-bold uppercase", getStatusColor(displayTicket.status))}>
                            {displayTicket.status}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {ticket.type === 'VM' && (
                      <div className="bg-indigo-50/30 border border-indigo-100/30 rounded-[2rem] p-8 grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-4">
                        <div className="space-y-1">
                          <p className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em]">CPU Units</p>
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <input 
                                type="number" 
                                className="w-16 bg-white border border-indigo-100 rounded-lg px-2 py-1 text-[13px] font-bold text-indigo-900 outline-none focus:border-indigo-400"
                                value={editData.cpu}
                                onChange={(e) => setEditData({ ...editData, cpu: parseInt(e.target.value) || 0 })}
                              />
                              <span className="text-[11px] font-bold text-indigo-400">CORE</span>
                            </div>
                          ) : (
                            <p className="text-[15px] font-bold text-indigo-950 flex items-center gap-1.5">
                              <Zap className="w-4 h-4 text-indigo-400" /> {displayTicket.cpu}CORE
                            </p>
                          )}
                        </div>
                        <div className="space-y-1 md:border-l md:border-indigo-100/50 md:pl-6">
                          <p className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em]">Memory RAM</p>
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <input 
                                type="number" 
                                className="w-16 bg-white border border-indigo-100 rounded-lg px-2 py-1 text-[13px] font-bold text-indigo-900 outline-none focus:border-indigo-400"
                                value={editData.ram}
                                onChange={(e) => setEditData({ ...editData, ram: parseInt(e.target.value) || 0 })}
                              />
                              <span className="text-[11px] font-bold text-indigo-400">GB</span>
                            </div>
                          ) : (
                            <p className="text-[15px] font-bold text-indigo-950 flex items-center gap-1.5">
                              <Layers className="w-4 h-4 text-indigo-400" /> {displayTicket.ram}GB
                            </p>
                          )}
                        </div>
                        <div className="space-y-1 md:border-l md:border-indigo-100/50 md:pl-6">
                          <p className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em]">Disk Storage</p>
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <input 
                                type="number" 
                                className="w-16 bg-white border border-indigo-100 rounded-lg px-2 py-1 text-[13px] font-bold text-indigo-900 outline-none focus:border-indigo-400"
                                value={editData.disk}
                                onChange={(e) => setEditData({ ...editData, disk: parseInt(e.target.value) || 0 })}
                              />
                              <span className="text-[11px] font-bold text-indigo-400">GB</span>
                            </div>
                          ) : (
                            <p className="text-[15px] font-bold text-indigo-950 flex items-center gap-1.5">
                              <Monitor className="w-4 h-4 text-indigo-400" /> {displayTicket.disk || 0}GB
                            </p>
                          )}
                        </div>
                        <div className="space-y-1 md:border-l md:border-indigo-100/50 md:pl-6 max-w-[200px] w-full">
                          <p className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em]">OS Template</p>
                          {isEditing ? (
                            <select 
                              className="w-full bg-white border border-indigo-100 rounded-lg px-2 py-1 text-[13px] font-bold text-indigo-900 outline-none focus:border-indigo-400"
                              value={editData.osTemplate}
                              onChange={(e) => setEditData({ ...editData, osTemplate: e.target.value })}
                            >
                              <option value="" disabled>Select OS Template</option>
                              {osTemplates?.map(os => (
                                <option key={os.id} value={os.name}>{os.name}</option>
                              ))}
                            </select>
                          ) : (
                            <p className="text-[15px] font-bold text-indigo-950 truncate" title={displayTicket.osTemplate}>
                              {displayTicket.osTemplate}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="glass-card bg-white border border-slate-100 p-8 rounded-3xl space-y-4">
                      <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-widest border-b border-slate-50 pb-4 flex items-center gap-2">
                        <Edit2 className="w-4 h-4 text-slate-400" /> Description
                      </h3>
                      <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-100/50">
                        {isEditing ? (
                          <textarea 
                            id="ticket-edit-description"
                            className="w-full bg-white border border-indigo-100 rounded-xl p-4 text-[13px] text-slate-600 font-medium outline-none focus:border-indigo-400 min-h-[150px] resize-none"
                            value={editData.description}
                            onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                          />
                        ) : (
                          <p className="text-[13px] text-slate-600 leading-relaxed font-medium whitespace-pre-wrap">
                            {displayTicket.notes || displayTicket.description || "No additional description provided."}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Ticket Attachments */}
                    {(isEditing || (displayTicket.attachments && displayTicket.attachments.length > 0)) && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                            <Paperclip className="w-4 h-4 text-slate-400" /> {isEditing ? 'Manage Attachments' : 'Original Attachments'}
                          </h3>
                          {isEditing && (
                            <div>
                              <input 
                                type="file" 
                                id="edit-attachment"
                                className="hidden" 
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    if (file.size > 10 * 1024 * 1024) return alert("File is too large. Max 10MB.");
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                      let base64 = reader.result as string;
                                      const dataParts = base64.split(',');
                                      const metaParts = dataParts[0].split(';');
                                      const newMeta = [metaParts[0], `name=${file.name}`, ...metaParts.slice(1)].join(';');
                                      setEditData({ ...editData, attachments: [...(editData.attachments || []), newMeta + ',' + dataParts[1]] });
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                              <label htmlFor="edit-attachment" className="text-[10px] font-bold text-blue-600 uppercase tracking-widest flex items-center gap-1 cursor-pointer">
                                <Plus className="w-3 h-3" /> Add File
                              </label>
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-4 gap-4">
                          {(isEditing ? editData.attachments : displayTicket.attachments)?.map((at: string, idx: number) => (
                            <div key={idx} className="relative group aspect-square rounded-2xl overflow-hidden border border-slate-100 bg-white flex items-center justify-center">
                              {isImageAttachment(at) ? (
                                <img src={sanitizeDataUrl(at)} className="w-full h-full object-cover cursor-pointer" onClick={() => setPreviewImage(at)} />
                              ) : (
                                <div className="flex flex-col items-center gap-2 p-4 text-center w-full">
                                  <Paperclip className="w-8 h-8 text-indigo-600" />
                                  <span className="text-[9px] font-bold text-slate-400 truncate w-full" title={getAttachmentFilename(at)}>{getAttachmentFilename(at)}</span>
                                </div>
                              )}
                              <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <a 
                                  href={sanitizeDataUrl(at)} 
                                  download={getAttachmentFilename(at)} 
                                  className="p-2 bg-white rounded-xl shadow-lg text-slate-900"
                                  title={`Download ${getAttachmentFilename(at)}`}
                                >
                                  <Download className="w-4 h-4" />
                                </a>
                                {isEditing && (
                                  <button 
                                    onClick={() => setEditData({ ...editData, attachments: editData.attachments.filter((_, i) => i !== idx) })}
                                    className="p-2 bg-rose-500 text-white rounded-xl shadow-lg hover:bg-rose-600"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Followers */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                          <Users className="w-4 h-4 text-slate-400" /> Ticket Followers
                        </h3>
                        <button onClick={() => setShowFollowerPanel(!showFollowerPanel)} className="text-[10px] font-bold text-blue-600 uppercase tracking-widest flex items-center gap-1">
                          <Plus className="w-3 h-3" /> Add Follower
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 relative">
                        {displayTicket.followers?.map((f: any) => (
                          <div key={f.id} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-xl border border-slate-200 group">
                            <span className="text-[11px] font-bold text-slate-600">{f.fullName}</span>
                            <button onClick={() => removeFollowerMutation.mutate(f.id)} className="p-0.5 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><X className="w-3 h-3" /></button>
                          </div>
                        ))}

                        <AnimatePresence>
                          {showFollowerPanel && (
                            <motion.div 
                              initial={{ opacity: 0, y: 10, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 10, scale: 0.95 }}
                              className="absolute top-full left-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 z-50 space-y-3"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select User</span>
                                <button onClick={() => setShowFollowerPanel(false)} className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
                              </div>
                              <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
                                {users?.filter((u: any) => !displayTicket.followers?.some((f: any) => f.id === u.id)).map((u: any) => (
                                  <button 
                                    key={u.id}
                                    onClick={() => {
                                      addFollowerMutation.mutate(u.id);
                                      setShowFollowerPanel(false);
                                    }}
                                    className="w-full flex items-center gap-3 p-2 hover:bg-slate-50 rounded-xl transition-all group"
                                  >
                                    <div className="w-7 h-7 rounded-full bg-indigo-50 flex items-center justify-center text-[10px] font-bold text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                      {u.fullName.charAt(0)}
                                    </div>
                                    <span className="text-[11px] font-bold text-slate-700">{u.fullName}</span>
                                  </button>
                                ))}
                                {(!users || users.length === 0) && <p className="text-[10px] text-slate-400 text-center py-4 italic">No users available</p>}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Conversation */}
                  <div className="w-[450px] flex flex-col bg-white">
                    <div className="p-8 border-b border-slate-50 bg-slate-50/10">
                      <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-widest flex items-center gap-3">
                        <MessageSquare className="w-4 h-4 text-indigo-600" /> Conversation
                      </h3>
                    </div>
                    <div ref={commentScrollRef} className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                      {isLoadingComments ? (
                        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-200" /></div>
                      ) : (
                        comments?.map((comment: Comment) => renderComment(comment))
                      )}
                    </div>
                    <div className="p-8 border-t border-slate-100 bg-white">
                      <form onSubmit={handleSendComment} className="space-y-4">
                        {attachment && (
                          <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm animate-fade-in">
                            <div className="flex items-center gap-3 overflow-hidden">
                              {isImageAttachment(attachment) ? (
                                <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-200 bg-white flex items-center justify-center shrink-0">
                                  <img src={sanitizeDataUrl(attachment)} alt="Preview" className="w-full h-full object-cover" />
                                </div>
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                                  <Paperclip className="w-5 h-5" />
                                </div>
                              )}
                              <div className="flex flex-col overflow-hidden">
                                <span className="text-[11px] font-bold text-slate-900 truncate max-w-[200px]">
                                  {decodeURIComponent(attachment.split(';').find(p => p.startsWith('name='))?.split('=')[1] || 'Attached File')}
                                </span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                  {attachment.split(';')[0].split(':')[1].split('/')[1]?.toUpperCase() || 'FILE'}
                                </span>
                              </div>
                            </div>
                            <button 
                              type="button" 
                              onClick={() => setAttachment(null)}
                              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                        <div className="relative">
                          <textarea 
                            ref={textareaRef}
                            className="w-full pr-24 py-4 min-h-[100px] text-sm font-medium border-slate-100 rounded-2xl bg-slate-50 focus:bg-white focus:border-indigo-400 transition-all outline-none resize-none"
                            placeholder="Type a message..."
                            value={commentText}
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
                                    let base64 = reader.result as string;
                                    const dataParts = base64.split(',');
                                    const metaParts = dataParts[0].split(';');
                                    const newMeta = [metaParts[0], `name=${filename}`, ...metaParts.slice(1)].join(';');
                                    setAttachment(newMeta + ',' + dataParts[1]);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }
                            }}
                          />
                          
                          {/* Premium Mentions Autocomplete Dropdown */}
                          <AnimatePresence>
                            {showMentionDropdown && filteredMentionUsers.length > 0 && (
                              <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.98 }}
                                className="absolute bottom-full left-0 mb-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-50 max-h-56 overflow-y-auto custom-scrollbar space-y-0.5"
                              >
                                <div className="px-3 py-1.5 border-b border-slate-50 flex items-center justify-between">
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Mention User</span>
                                  <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md">
                                    {filteredMentionUsers.length} found
                                  </span>
                                </div>
                                {filteredMentionUsers.map((user: any, index: number) => (
                                  <button
                                    key={user.id}
                                    type="button"
                                    onClick={() => insertMention(user)}
                                    className={cn(
                                      "w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left",
                                      index === activeMentionIndex 
                                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/10" 
                                        : "hover:bg-slate-50 text-slate-700"
                                    )}
                                    onMouseEnter={() => setActiveMentionIndex(index)}
                                  >
                                    <div className={cn(
                                      "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors",
                                      index === activeMentionIndex
                                        ? "bg-white/20 text-white"
                                        : "bg-indigo-50 text-indigo-600"
                                    )}>
                                      {user.fullName.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                      <span className={cn(
                                        "text-[11px] font-bold truncate",
                                        index === activeMentionIndex ? "text-white" : "text-slate-700"
                                      )}>
                                        {user.fullName}
                                      </span>
                                      <span className={cn(
                                        "text-[9px] truncate font-medium",
                                        index === activeMentionIndex ? "text-white/70" : "text-slate-400"
                                      )}>
                                        @{user.username || user.fullName.replace(/\s+/g, '').toLowerCase()}
                                      </span>
                                    </div>
                                  </button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <div className="absolute right-3 bottom-3 flex items-center gap-2">
                            <label className="p-2.5 hover:bg-slate-100 rounded-xl text-slate-400 cursor-pointer transition-all">
                              <input type="file" className="hidden" onChange={onFileUpload} />
                              <Paperclip className="w-5 h-5" />
                            </label>
                            <button type="submit" disabled={(!commentText.trim() && !attachment) || commentMutation.isPending} className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-700 disabled:opacity-50 transition-all">
                              {commentMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>
                      </form>
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Image Preview Lightbox */}
      <AnimatePresence>
        {previewImage && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-8 bg-slate-950/90 backdrop-blur-md" onClick={() => setPreviewImage(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative max-w-7xl max-h-full">
              <img src={sanitizeDataUrl(previewImage)} className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl border border-white/10" onClick={(e) => e.stopPropagation()} />
              <button onClick={() => setPreviewImage(null)} className="absolute -top-12 right-0 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all">
                <X className="w-6 h-6" />
              </button>
              <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex gap-4">
                 <a 
                  href={sanitizeDataUrl(previewImage)} 
                  download={getAttachmentFilename(previewImage)} 
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
    </AnimatePresence>
  );
}
