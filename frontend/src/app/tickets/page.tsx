"use client";
import { PageHeader } from "@/components/PageHeader";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { Footer } from "@/components/Footer";
import { Pagination } from "@/components/Pagination";
import { TicketDetailModal } from "@/components/TicketDetailModal";
import { 
  Ticket, 
  Search, 
  Loader2, 
  Clock, 
  Monitor,
  Zap,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
  MessageSquare,
  ShieldCheck,
  User as UserIcon,
  Plus,
  ChevronDown,
  ExternalLink,
  Shield,
  Key,
  Globe,
  LifeBuoy,
  Tag,
  Layers,
  Paperclip,
  Trash2,
  ImageIcon,
  Download
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useBranding } from "@/context/branding-context";
import { useIsAdmin } from "@/hooks/useIsAdmin";


interface UnifiedTicket {
  id: string;
  ticketId: string;
  type: 'VM' | 'SERVICE' | 'SUPPORT';
  title: string;
  subtitle: string;
  environment?: string;
  status: string;
  createdAt: string;
  actionedBy?: string;
  requestedBy?: string;
  requestedById?: string;
  priority?: string;
  category?: string;
  tags?: string[];
  attachments?: string[];
  followers?: { id: string; fullName: string }[];
  comments?: any[];
}

export default function TicketsPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-white"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>}>
      <TicketsContent />
    </Suspense>
  );
}

function TicketsContent() {
  const { formatDate } = useBranding();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;
  const [isProcessing, setIsProcessing] = useState(null as string | null);

  // Catalogs Query for Dynamic Categories
  const { data: catalogs = [] } = useQuery({
    queryKey: ["catalogs"],
    queryFn: async () => {
      const res = await api.get("/catalog");
      return res.data;
    }
  });

  // User Profile for Role Checks
  const { isAdmin, permissions, profile } = useIsAdmin();
  const canApprove = isAdmin || permissions.includes("APPROVE_REQUESTS");
  
  // Modals State
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showCreateSupportModal, setShowCreateSupportModal] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [selectedTicketForAction, setSelectedTicketForAction] = useState(null as UnifiedTicket | null);
  const [selectedTicketForDetail, setSelectedTicketForDetail] = useState(null as UnifiedTicket | null);
  
  const [rejectionReason, setRejectionReason] = useState("");
  const [approveData, setApproveData] = useState({ ipAddress: "", sshUser: "root", sshPassword: "", sshPort: "22" });

  const isValidIPv4 = (ip: string) => {
    const ipv4Regex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipv4Regex.test(ip);
  };

  const isValidHostname = (host: string) => {
    const hostRegex = /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/;
    return hostRegex.test(host);
  };

  const isIpValid = !approveData.ipAddress || (
    selectedTicketForAction?.type === 'VM'
      ? isValidIPv4(approveData.ipAddress)
      : (isValidIPv4(approveData.ipAddress) || isValidHostname(approveData.ipAddress))
  );

  const isPortValid = !approveData.sshPort || (
    /^\d+$/.test(approveData.sshPort) && 
    parseInt(approveData.sshPort) > 0 && 
    parseInt(approveData.sshPort) <= 65535
  );

  const isFormValid = 
    (!approveData.ipAddress || (selectedTicketForAction?.type === 'VM' ? isValidIPv4(approveData.ipAddress) : (isValidIPv4(approveData.ipAddress) || isValidHostname(approveData.ipAddress)))) &&
    (!approveData.sshPort || (/^\d+$/.test(approveData.sshPort) && parseInt(approveData.sshPort) > 0 && parseInt(approveData.sshPort) <= 65535));
  
  const [ticketViews, setTicketViews] = useState({} as Record<string, number>);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const views = localStorage.getItem("yato_ticket_views");
      if (views) {
        try {
          setTicketViews(JSON.parse(views));
        } catch (e) {
          console.error("Failed to parse ticket views", e);
        }
      }
    }
  }, []);

  const handleOpenTicket = (ticket: UnifiedTicket) => {
    setSelectedTicketForDetail(ticket);
    const now = Date.now();
    const updatedViews = { ...ticketViews, [ticket.id]: now };
    setTicketViews(updatedViews);
    localStorage.setItem("yato_ticket_views", JSON.stringify(updatedViews));
  };

  const [newSupportTicket, setNewSupportTicket] = useState({ 
    subject: "", 
    description: "", 
    priority: "NORMAL", 
    category: "GENERAL",
    tags: [] as string[],
    attachments: [] as string[] 
  } as {
    subject: string;
    description: string;
    priority: string;
    category: string;
    tags: string[];
    attachments: string[];
  });
  
  const [tagInput, setTagInput] = useState("");
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);

  const { data: existingTags = [], refetch: refetchTags } = useQuery({
    queryKey: ["support-tags"],
    queryFn: async () => {
      const res = await api.get("/support-tickets/tags");
      return res.data;
    },
    initialData: []
  });

  // Deep Link Handling
  useEffect(() => {
    const tid = searchParams.get('id');
    const type = searchParams.get('type');
    
    if (tid && type) {
      setSelectedTicketForDetail({
        id: tid,
        type: type as any,
        ticketId: 'Loading...',
        title: 'Loading Ticket...',
        subtitle: 'Please wait',
        status: 'OPEN',
        createdAt: new Date().toISOString()
      });

      // Mark as read
      const now = Date.now();
      setTicketViews(prev => {
        const updated = { ...prev, [tid]: now };
        localStorage.setItem("yato_ticket_views", JSON.stringify(updated));
        return updated;
      });
    }
  }, [searchParams]);

  const createSupportMutation = useMutation({
    mutationFn: (data: typeof newSupportTicket) => api.post("/support-tickets", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["support-tags"] });
      setShowCreateSupportModal(false);
      setNewSupportTicket({ subject: "", description: "", priority: "NORMAL", category: "GENERAL", tags: [], attachments: [] });
    },
  });

  const vmApproveMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data?: any }) => api.put(`/vm/request/${id}/approve`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vm-requests"] });
      queryClient.invalidateQueries({ queryKey: ["vm-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setShowApproveModal(false);
    },
  });

  const vmRejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => 
      api.put(`/vm/request/${id}/reject`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vm-requests"] });
      setShowRejectModal(false);
    },
  });

  const svcApproveMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data?: any }) => api.put(`/service/request/${id}/approve`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-requests"] });
      queryClient.invalidateQueries({ queryKey: ["service-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setShowApproveModal(false);
    },
  });

  const svcRejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => 
      api.put(`/service/request/${id}/reject`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-requests"] });
      setShowRejectModal(false);
    },
  });

  const deleteTicketMutation = useMutation({
    mutationFn: ({ id, type }: { id: string; type: 'VM' | 'SERVICE' | 'SUPPORT' }) => {
      if (type === 'VM') {
        return api.delete(`/vm/request/${id}`);
      } else if (type === 'SERVICE') {
        return api.delete(`/service/request/${id}`);
      } else {
        return api.delete(`/support-tickets/${id}`);
      }
    },
    onSuccess: (_, variables) => {
      if (variables.type === 'VM') {
        queryClient.invalidateQueries({ queryKey: ["vm-requests"] });
      } else if (variables.type === 'SERVICE') {
        queryClient.invalidateQueries({ queryKey: ["service-requests"] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      }
    },
  });

  const handleDeleteTicket = async (e: React.MouseEvent, ticket: UnifiedTicket) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to permanently delete ticket ${ticket.ticketId}?\n\nThis action cannot be undone.`)) return;
    try {
      await deleteTicketMutation.mutateAsync({ id: ticket.id, type: ticket.type });
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete ticket.');
    }
  };

  const handleAction = async (e: React.MouseEvent | null, ticket: UnifiedTicket, action: 'approve' | 'reject') => {
    if (e) e.stopPropagation();
    setSelectedTicketForAction(ticket);

    if (action === 'reject') {
      setRejectionReason("");
      setShowRejectModal(true);
      return;
    }

    if (ticket.type === 'VM' || ticket.type === 'SERVICE') {
      setApproveData({ ipAddress: "", sshUser: ticket.type === 'VM' ? "root" : "admin", sshPassword: "", sshPort: ticket.type === 'VM' ? "22" : "" });
      setShowApproveModal(true);
      return;
    }

    if (ticket.type === 'SUPPORT') {
      const newStatus = action === 'approve' ? 'RESOLVED' : 'CLOSED';
      api.put(`/support-tickets/${ticket.id}/status`, { status: newStatus }).then(() => {
        queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      });
      return;
    }
  };

  const confirmRejection = async () => {
    if (!selectedTicketForAction || !rejectionReason.trim()) return;
    
    setIsProcessing(selectedTicketForAction.id);
    try {
      if (selectedTicketForAction.type === 'VM') {
        await vmRejectMutation.mutateAsync({ id: selectedTicketForAction.id, reason: rejectionReason });
      } else if (selectedTicketForAction.type === 'SERVICE') {
        await svcRejectMutation.mutateAsync({ id: selectedTicketForAction.id, reason: rejectionReason });
      }
      setShowRejectModal(false);
    } catch (e: any) { console.error(e); }
    finally { setIsProcessing(null); }
  };

  const confirmApproval = async () => {
    if (!selectedTicketForAction || !isFormValid) return;
    
    setIsProcessing(selectedTicketForAction.id);
    try {
      const data = approveData.ipAddress ? {
        address: approveData.ipAddress,
        port: parseInt(approveData.sshPort) || undefined,
        username: approveData.sshUser,
        password: approveData.sshPassword
      } : {};

      if (selectedTicketForAction.type === 'VM') {
        await vmApproveMutation.mutateAsync({ 
          id: selectedTicketForAction.id, 
          data: approveData.ipAddress ? {
            ipAddress: approveData.ipAddress,
            sshPort: parseInt(approveData.sshPort) || 22,
            sshUser: approveData.sshUser,
            sshPassword: approveData.sshPassword
          } : {} 
        });
      } else if (selectedTicketForAction.type === 'SERVICE') {
        await svcApproveMutation.mutateAsync({
          id: selectedTicketForAction.id,
          data
        });
      }
    } catch (e: any) { console.error(e); }
    finally { setIsProcessing(null); }
  };

  const { data: vmRequests, isLoading: isLoadingVm } = useQuery({
    queryKey: ["vm-requests"],
    queryFn: async () => {
      try {
        const response = await api.get("/vm/request/");
        return response.data;
      } catch (e: any) { return []; }
    },
  });

  const { data: serviceRequests, isLoading: isLoadingService } = useQuery({
    queryKey: ["service-requests"],
    queryFn: async () => {
      try {
        const response = await api.get("/service/request/");
        return response.data;
      } catch (e: any) { return []; }
    },
  });

  const { data: supportTickets, isLoading: isLoadingSupport } = useQuery({
    queryKey: ["support-tickets"],
    queryFn: async () => {
      try {
        const response = await api.get("/support-tickets");
        return response.data;
      } catch (e: any) { return []; }
    },
  });

  const tickets: UnifiedTicket[] = [
    ...(vmRequests || []).map((r: any) => ({
      id: r.id,
      ticketId: r.ticketId,
      type: 'VM' as const,
      title: r.hostname,
      subtitle: `CPU: ${r.cpu} CORE, RAM: ${r.ram}GB, Storage: ${r.disk || 0}GB, OS: ${r.osTemplate}`,
      environment: r.environment,
      status: r.status,
      createdAt: r.createdAt,
      requestedBy: r.user?.fullName,
      requestedById: r.requestedBy,
      actionedBy: r.admin?.fullName,
      followers: r.followers,
      comments: r.comments
    })),
    ...(serviceRequests || []).map((r: any) => ({
      id: r.id,
      ticketId: r.ticketId,
      type: 'SERVICE' as const,
      title: r.serviceName,
      subtitle: r.version,
      environment: r.environment,
      status: r.status,
      createdAt: r.createdAt,
      requestedBy: r.user?.fullName,
      requestedById: r.requestedBy,
      actionedBy: r.admin?.fullName,
      followers: r.followers,
      comments: r.comments
    })),
    ...(supportTickets || []).map((r: any) => ({
      id: r.id,
      ticketId: r.ticketId,
      type: 'SUPPORT' as const,
      title: r.subject,
      subtitle: r.description.substring(0, 50) + "...",
      status: r.status,
      createdAt: r.createdAt,
      requestedBy: r.user?.fullName,
      requestedById: r.requestedBy,
      priority: r.priority,
      category: r.category,
      tags: r.tags,
      attachments: r.attachments,
      followers: r.followers,
      comments: r.comments
    }))
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const filteredTickets = tickets.filter((t: UnifiedTicket) => 
    t.ticketId.toLowerCase().includes(search.toLowerCase()) ||
    t.title.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const totalPages = Math.ceil(filteredTickets.length / itemsPerPage);
  const paginatedTickets = filteredTickets.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
      case 'COMPLETED':
      case 'RESOLVED':
        return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'REJECTED':
      case 'FAILED':
      case 'CLOSED':
        return 'bg-rose-50 text-rose-600 border-rose-100';
      case 'PROVISIONING':
      case 'IN_PROGRESS':
        return 'bg-blue-50 text-blue-600 border-blue-100';
      default:
        return 'bg-amber-50 text-amber-600 border-amber-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED':
      case 'COMPLETED':
      case 'RESOLVED':
        return <CheckCircle2 className="w-3 h-3" />;
      case 'REJECTED':
      case 'FAILED':
      case 'CLOSED':
        return <XCircle className="w-3 h-3" />;
      case 'PROVISIONING':
      case 'IN_PROGRESS':
        return <Loader2 className="w-3 h-3 animate-spin" />;
      default:
        return <AlertCircle className="w-3 h-3" />;
    }
  };

  const addTagValue = (value: string) => {
    const trimmed = value.trim().toUpperCase();
    if (trimmed && !newSupportTicket.tags.includes(trimmed)) {
      setNewSupportTicket({
        ...newSupportTicket,
        tags: [...newSupportTicket.tags, trimmed]
      });
    }
    setTagInput("");
    setShowTagSuggestions(false);
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (tagInput.trim()) {
        addTagValue(tagInput);
      }
    }
  };

  const removeTag = (tag: string) => {
    setNewSupportTicket({
      ...newSupportTicket,
      tags: newSupportTicket.tags.filter((t: string) => t !== tag)
    });
  };

  const onFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Limit to 10MB
        if (file.size > 10 * 1024 * 1024) {
          alert(`File ${file.name} is too large. Max 10MB.`);
          continue;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
          let dataUrl = reader.result as string;
          
          // Inject original filename into Data URL metadata
          // Format: data:[mime];name=[filename];base64,[data]
          if (dataUrl.startsWith('data:')) {
            const parts = dataUrl.split(',');
            const header = parts[0];
            const base64Data = parts[1];
            dataUrl = `${header};name=${encodeURIComponent(file.name)},${base64Data}`;
          }

          setNewSupportTicket(prev => ({
            ...prev,
            attachments: [...prev.attachments, dataUrl]
          }));
        };
        reader.readAsDataURL(file);
      }
    }
  };

  return (
    <div className="flex h-screen bg-white antialiased text-slate-600">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <MobileNav />
        <main className="page-container overflow-y-auto custom-scrollbar">
          <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <PageHeader title="Support & Requests" subtitle="Consolidated resource provisioning queue and approvals" />
              </div>

              <div className="relative">
                <button 
                  onClick={() => setShowCreateMenu(!showCreateMenu)}
                  className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-bold text-[13px] shadow-lg shadow-blue-600/20 flex items-center gap-2.5 hover:bg-blue-700 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Create Ticket
                  <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showCreateMenu && "rotate-180")} />
                </button>
                
                <AnimatePresence>
                  {showCreateMenu && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden"
                    >
                      <Link 
                        href="/vm/request" 
                        className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors border-b border-slate-50"
                      >
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                          <Monitor className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[13px] font-bold text-slate-900">Virtual Machine</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Provisioning</p>
                        </div>
                      </Link>
                      <Link 
                        href="/service/request" 
                        className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors border-b border-slate-50"
                      >
                        <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                          <Zap className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[13px] font-bold text-slate-900">Access Service</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Capability</p>
                        </div>
                      </Link>
                      <button 
                        onClick={() => { setShowCreateSupportModal(true); setShowCreateMenu(false); }}
                        className="w-full text-left flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                          <LifeBuoy className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[13px] font-bold text-slate-900">General Support</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Assistance</p>
                        </div>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </header>

            <div className="flex gap-4 mb-8">
              <div className="relative flex-1 group">
                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                <input 
                  type="text" 
                  className="bg-white border border-slate-200 rounded-lg pl-11 pr-4 py-2.5 text-sm w-full focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all" 
                  placeholder="Search by Ticket ID, Hostname or Service..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button className="bg-white border border-slate-200 text-slate-600 px-5 py-2.5 rounded-lg font-bold text-[13px] shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filter
              </button>
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
              {(isLoadingVm || isLoadingService || isLoadingSupport) ? (
                <div className="flex flex-col items-center justify-center py-32 text-slate-400">
                  <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-600" />
                  <p className="text-sm font-bold uppercase tracking-widest">Synchronizing tickets...</p>
                </div>
              ) : filteredTickets.length === 0 ? (
                <div className="py-32 text-center">
                  <Ticket className="w-12 h-12 text-slate-100 mx-auto mb-4" />
                  <p className="text-slate-400 font-medium">No tickets found matching your criteria.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ticket ID</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ticket Name</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Resource Type</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ownership</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Created At</th>
                        <th className="px-6 py-4 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {paginatedTickets.map((ticket: UnifiedTicket) => {
                        const lastViewedAt = ticketViews[ticket.id];
                        const isNew = !lastViewedAt && (new Date().getTime() - new Date(ticket.createdAt).getTime() < 24 * 60 * 60 * 1000);
                        const lastCommentTime = ticket.comments && ticket.comments.length > 0
                          ? new Date(ticket.comments[ticket.comments.length - 1].createdAt).getTime()
                          : new Date(ticket.createdAt).getTime();

                        let isUnread = false;
                        if (ticket.status === 'OPEN' || ticket.status === 'PENDING') {
                          const isCreator = ticket.requestedById === profile?.id;
                          if (isCreator) {
                            // Creator: unread only if there are comments from someone else, and either never viewed or a comment is newer than last viewed
                            const hasOtherComments = ticket.comments && ticket.comments.some((c: any) => c.authorId !== profile?.id);
                            if (hasOtherComments) {
                              isUnread = !lastViewedAt || lastCommentTime > lastViewedAt;
                            }
                          } else {
                            // Admin / non-creator: unread if never viewed, or if there are comments/creation newer than last viewed
                            isUnread = !lastViewedAt || lastCommentTime > lastViewedAt;
                          }
                        }

                        return (
                          <motion.tr 
                            key={ticket.id} 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            onClick={() => handleOpenTicket(ticket)}
                            className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                          >
                            <td className="px-6 py-6">
                              <span className="font-mono text-[11px] font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                                {ticket.ticketId}
                              </span>
                            </td>
                            <td className="px-6 py-6">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 text-[13px]">{ticket.title}</span>
                                {isNew && (
                                  <span className="text-[9px] font-extrabold px-1.5 py-0.5 bg-emerald-500 text-white rounded shrink-0 shadow-sm uppercase tracking-wider">
                                    NEW
                                  </span>
                                )}
                                {isUnread && (
                                  <span className="text-[9px] font-extrabold px-1.5 py-0.5 bg-amber-500 text-white rounded shrink-0 shadow-sm uppercase tracking-wider">
                                    UNREAD
                                  </span>
                                )}
                              </div>
                            </td>
                          <td className="px-6 py-6">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center border",
                                ticket.type === 'VM' ? "bg-indigo-50 border-indigo-100 text-indigo-600" : 
                                ticket.type === 'SERVICE' ? "bg-amber-50 border-amber-100 text-amber-600" :
                                "bg-emerald-50 border-emerald-100 text-emerald-600"
                              )}>
                                {ticket.type === 'VM' ? <Monitor className="w-4 h-4" /> : 
                                 ticket.type === 'SERVICE' ? <Zap className="w-4 h-4" /> :
                                 <LifeBuoy className="w-4 h-4" />}
                              </div>
                              <span className="font-bold text-slate-700 text-[13px]">{ticket.type === 'SUPPORT' ? (ticket.category || 'SUPPORT') : ticket.type + ' Request'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-6">
                            <div className="flex flex-col gap-0.5">
                              <span className="flex items-center gap-1.5 text-[13px] font-bold text-slate-900">
                                {ticket.requestedBy || 'Unknown'}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{ticket.environment || ticket.priority || 'NORMAL'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-6">
                            <div className="flex flex-col gap-2">
                              <span className={cn(
                                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-widest border w-fit",
                                getStatusColor(ticket.status)
                              )}>
                                {getStatusIcon(ticket.status)}
                                {ticket.status}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-6 text-[12px] font-bold text-slate-500">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-slate-300" />
                              {formatDate(ticket.createdAt, { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>
                          <td className="px-6 py-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {ticket.status === 'PENDING' && canApprove && (
                                <>
                                  <button 
                                    onClick={(e) => handleAction(e, ticket, 'approve')}
                                    disabled={!!isProcessing}
                                    className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all border border-emerald-100 shadow-sm disabled:opacity-50"
                                  >
                                    {isProcessing === ticket.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                  </button>
                                  <button 
                                    onClick={(e) => handleAction(e, ticket, 'reject')}
                                    disabled={!!isProcessing}
                                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all border border-rose-100 shadow-sm disabled:opacity-50"
                                  >
                                    {isProcessing === ticket.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                                  </button>
                                </>
                              )}
                              {ticket.type === 'SUPPORT' && ticket.status === 'OPEN' && (
                                <button 
                                  onClick={(e) => handleAction(e, ticket, 'approve')}
                                  className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all border border-emerald-100"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </button>
                              )}
                               <button className="p-2 text-slate-400 hover:text-slate-900 transition-all">
                                 <ExternalLink className="w-4 h-4" />
                               </button>
                               {isAdmin && (
                                 <button 
                                   onClick={(e) => handleDeleteTicket(e, ticket)}
                                   disabled={deleteTicketMutation.isPending}
                                   className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                                   title="Delete Ticket (Admin)"
                                 >
                                   <Trash2 className="w-4 h-4" />
                                 </button>
                               )}
                             </div>
                           </td>
                         </motion.tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <Pagination 
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={filteredTickets.length}
                itemsPerPage={itemsPerPage}
              />
            </div>
            
         </main>
      </div>

      {/* Detail Modal */}
      {selectedTicketForDetail && (
        <TicketDetailModal 
          isOpen={!!selectedTicketForDetail}
          onClose={() => setSelectedTicketForDetail(null)}
          ticket={selectedTicketForDetail}
          isAdmin={canApprove}
          onApprove={(ticket) => handleAction(null, ticket, 'approve')}
          onReject={(ticket) => handleAction(null, ticket, 'reject')}
        />
      )}

      {/* Create Support Ticket Modal */}
      <AnimatePresence>
        {showCreateSupportModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white">
                    <LifeBuoy className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 uppercase tracking-normal">General Support</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">New Assistance Request</p>
                  </div>
                </div>
                <button onClick={() => setShowCreateSupportModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5" /> Category
                    </label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3.5 text-sm font-bold text-slate-700 focus:border-blue-500 outline-none transition-all appearance-none"
                      value={newSupportTicket.category}
                      onChange={(e) => setNewSupportTicket({ ...newSupportTicket, category: e.target.value })}
                    >
                      {catalogs && catalogs.filter((c: any) => c.category === 'SUPPORT_TICKET_CATEGORY').length > 0 ? (
                        catalogs
                          .filter((c: any) => c.category === 'SUPPORT_TICKET_CATEGORY')
                          .map((c: any) => (
                            <option key={c.id} value={c.value}>{c.name}</option>
                          ))
                      ) : (
                        <>
                          <option value="GENERAL">General Assistance</option>
                          <option value="INFRASTRUCTURE">Infrastructure Issue</option>
                          <option value="NETWORK">Networking & Connectivity</option>
                          <option value="SECURITY">Security & Access</option>
                          <option value="BILLING">Billing & Resources</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5" /> Priority
                    </label>
                    <div className="flex gap-2 h-[46px]">
                      {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((p: string) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setNewSupportTicket({ ...newSupportTicket, priority: p })}
                          className={cn(
                            "flex-1 rounded-lg text-[9px] font-bold border transition-all",
                            newSupportTicket.priority === p 
                              ? "bg-blue-600 border-blue-600 text-white shadow-md" 
                              : "bg-white border-slate-100 text-slate-400 hover:bg-slate-50"
                          )}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Subject</label>
                  <input 
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3.5 text-sm font-bold text-slate-900 focus:border-blue-500 outline-none transition-all"
                    placeholder="Briefly describe your issue..."
                    value={newSupportTicket.subject}
                    onChange={(e) => setNewSupportTicket({ ...newSupportTicket, subject: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Description</label>
                  <textarea 
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-4 text-[13px] font-medium min-h-[140px] focus:border-blue-500 outline-none transition-all resize-none"
                    placeholder="Provide full details of your request..."
                    value={newSupportTicket.description}
                    onChange={(e) => setNewSupportTicket({ ...newSupportTicket, description: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5" /> Tags
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {newSupportTicket.tags.map((tag: string) => (
                      <span key={tag} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-lg text-[10px] font-bold">
                        {tag}
                        <button onClick={() => removeTag(tag)} className="hover:text-blue-800"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                  <div className="relative">
                    <input 
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3.5 text-sm font-medium focus:border-blue-500 outline-none transition-all"
                      placeholder="Type or search existing tags (press Enter to add)..."
                      value={tagInput}
                      onChange={(e) => {
                        setTagInput(e.target.value);
                        setShowTagSuggestions(true);
                      }}
                      onFocus={() => setShowTagSuggestions(true)}
                      onKeyDown={handleAddTag}
                    />
                    
                    {showTagSuggestions && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowTagSuggestions(false)} />
                        <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 max-h-[160px] overflow-y-auto custom-scrollbar p-1.5 flex flex-col gap-0.5">
                          {(() => {
                            const filtered = existingTags.filter(t => 
                              t.toLowerCase().includes(tagInput.toLowerCase()) && 
                              !newSupportTicket.tags.includes(t.toUpperCase())
                            );
                            if (filtered.length === 0) {
                              if (tagInput.trim()) {
                                return (
                                  <button
                                    type="button"
                                    onClick={() => addTagValue(tagInput)}
                                    className="w-full text-left px-3 py-2 text-xs text-blue-600 font-bold hover:bg-slate-50 rounded-xl flex items-center justify-between"
                                  >
                                    <span>Create new tag "{tagInput.toUpperCase()}"</span>
                                    <span className="text-[9px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-lg border border-blue-100 uppercase font-black tracking-widest">New</span>
                                  </button>
                                );
                              }
                              return (
                                <p className="text-[10px] text-slate-400 text-center py-3 font-bold uppercase tracking-widest">No existing tags</p>
                              );
                            }
                            return filtered.map(tag => (
                              <button
                                type="button"
                                key={tag}
                                onClick={() => addTagValue(tag)}
                                className="w-full text-left px-3.5 py-2 text-xs text-slate-700 font-semibold hover:bg-slate-50 rounded-xl transition-all flex items-center justify-between"
                              >
                                <span>{tag}</span>
                                <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg border border-slate-200/50 uppercase font-bold">Existing</span>
                              </button>
                            ));
                          })()}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-2">
                    <Paperclip className="w-3.5 h-3.5" /> Attachments
                  </label>
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    {newSupportTicket.attachments.map((at: string, idx: number) => {
                      const isImage = at.startsWith('data:image/');
                      let fileName = "Attachment";
                      if (at.includes(';name=')) {
                        fileName = decodeURIComponent(at.split(';name=')[1].split(',')[0]);
                      }

                      return (
                        <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border-2 border-slate-100 bg-slate-50 flex items-center justify-center">
                          {isImage ? (
                            <img src={at.replace(/;name=[^;,\s]+/i, '')} className="w-full h-full object-cover" />
                          ) : (
                            <div className="flex flex-col items-center gap-2 p-2 text-center">
                              <Paperclip className="w-8 h-8 text-slate-300" />
                              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter truncate w-full px-1">{fileName}</span>
                            </div>
                          )}
                          <button 
                            onClick={() => setNewSupportTicket(prev => ({ ...prev, attachments: prev.attachments.filter((_, i) => i !== idx) }))}
                            className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-lg text-rose-500 shadow-sm opacity-0 group-hover:opacity-100 transition-all z-10"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                    <button 
                      type="button"
                      onClick={() => document.getElementById('file-upload')?.click()}
                      className="aspect-square rounded-xl border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-blue-600"
                    >
                      <Plus className="w-6 h-6" />
                      <span className="text-[9px] font-bold uppercase">Attach File</span>
                    </button>
                  </div>
                  <input 
                    id="file-upload"
                    type="file" 
                    hidden 
                    multiple
                    onChange={onFileUpload}
                  />
                </div>
              </div>

              <div className="p-8 border-t border-slate-100 bg-slate-50 flex gap-4">
                <button onClick={() => setShowCreateSupportModal(false)} className="flex-1 py-4 font-bold text-slate-500 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-200">
                  Cancel
                </button>
                <button 
                  onClick={() => createSupportMutation.mutate(newSupportTicket)}
                  disabled={!newSupportTicket.subject || !newSupportTicket.description || createSupportMutation.isPending}
                  className="flex-[2] py-4 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3"
                >
                  {createSupportMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Submit Support Request
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Approve VM Modal */}
      <AnimatePresence>
        {showApproveModal && selectedTicketForAction && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 uppercase tracking-normal">Approve {selectedTicketForAction.type === 'VM' ? 'VM' : 'Service'} Request</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedTicketForAction.ticketId}</p>
                  </div>
                </div>
                <button onClick={() => setShowApproveModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-2">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Shield className="w-3 h-3" /> Manual Configuration Option
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    Jika menggunakan Plugin Automated Provisioning (Proxmox/OpenStack), <strong>KOSONGKAN</strong> form ini. Bot akan menyelesaikannya secara otomatis. Isi manual hanya jika Anda memprovisi di luar sistem.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2 col-span-2">
                      <label className="text-[11px] font-bold text-slate-400 uppercase">
                        {selectedTicketForAction.type === 'VM' ? 'IP Address' : 'Host / IP Address'} <span className="text-slate-300 font-normal ml-1">(Optional)</span>
                      </label>
                      <div className="relative">
                        <Globe className={cn("w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2", (!isIpValid && approveData.ipAddress) ? "text-rose-400" : "text-slate-400")} />
                        <input 
                          className={cn(
                            "w-full bg-white border rounded-xl pl-11 pr-4 py-3 text-sm outline-none transition-all",
                            (!isIpValid && approveData.ipAddress) 
                              ? "border-rose-300 focus:border-rose-500 bg-rose-50/10 text-rose-900 placeholder-rose-300" 
                              : "border-slate-200 focus:border-blue-500"
                          )}
                          placeholder={selectedTicketForAction.type === 'VM' ? "e.g. 192.168.1.100" : "e.g. redis.prod.local"}
                          value={approveData.ipAddress}
                          onChange={(e) => setApproveData({ ...approveData, ipAddress: e.target.value })}
                        />
                      </div>
                      {!isIpValid && approveData.ipAddress && (
                        <p className="text-[10px] text-rose-500 font-bold uppercase tracking-wider mt-1">
                          {selectedTicketForAction.type === 'VM' ? 'Please enter a valid IPv4 address' : 'Please enter a valid IP address or hostname'}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-400 uppercase">
                        {selectedTicketForAction.type === 'VM' ? 'SSH Port' : 'Port'} <span className="text-slate-300 font-normal ml-1">(Optional)</span>
                      </label>
                      <input 
                        className={cn(
                          "w-full bg-white border rounded-xl px-4 py-3 text-sm outline-none transition-all",
                          (!isPortValid && approveData.sshPort) 
                            ? "border-rose-300 focus:border-rose-500 bg-rose-50/10 text-rose-900 placeholder-rose-300" 
                            : "border-slate-200 focus:border-blue-500"
                        )}
                        placeholder={selectedTicketForAction.type === 'VM' ? "22" : "6379"}
                        value={approveData.sshPort}
                        onChange={(e) => setApproveData({ ...approveData, sshPort: e.target.value })}
                      />
                      {!isPortValid && approveData.sshPort && (
                        <p className="text-[10px] text-rose-500 font-bold uppercase tracking-wider mt-1">
                          Must be 1-65535
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-400 uppercase">
                        {selectedTicketForAction.type === 'VM' ? 'SSH User' : 'Username'} <span className="text-slate-300 font-normal ml-1">(Optional)</span>
                      </label>
                      <div className="relative">
                        <UserIcon className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                          className="w-full bg-white border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm focus:border-blue-500 outline-none transition-all"
                          placeholder={selectedTicketForAction.type === 'VM' ? "root" : "admin"}
                          value={approveData.sshUser}
                          onChange={(e) => setApproveData({ ...approveData, sshUser: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-400 uppercase">
                        {selectedTicketForAction.type === 'VM' ? 'SSH Password' : 'Password'} <span className="text-slate-300 font-normal ml-1">(Optional)</span>
                      </label>
                      <div className="relative">
                        <Key className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                          type="password"
                          className="w-full bg-white border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm focus:border-blue-500 outline-none transition-all"
                          placeholder="••••••••"
                          value={approveData.sshPassword}
                          onChange={(e) => setApproveData({ ...approveData, sshPassword: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setShowApproveModal(false)} className="flex-1 py-3.5 font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-all">
                    Cancel
                  </button>
                  <button 
                    onClick={confirmApproval}
                    disabled={vmApproveMutation.isPending || !isFormValid}
                    className="flex-1 py-3.5 font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {vmApproveMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Approve & Deploy"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rejection Modal */}
      <AnimatePresence>
        {showRejectModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">Reject Request</h3>
                <button onClick={() => setShowRejectModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Reason for Rejection</label>
                  <textarea 
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-4 text-sm min-h-[120px] focus:border-blue-500 outline-none transition-all"
                    placeholder="Provide context for the rejection..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                  />
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setShowRejectModal(false)} className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-all">
                    Cancel
                  </button>
                  <button 
                    onClick={confirmRejection}
                    disabled={!rejectionReason.trim() || !!isProcessing}
                    className="flex-1 py-3 font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-xl transition-all shadow-lg shadow-rose-500/20 disabled:opacity-50"
                  >
                    Confirm Rejection
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
