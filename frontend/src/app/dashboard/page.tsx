"use client";
import { PageHeader } from "@/components/PageHeader";

import { useQuery } from "@tanstack/react-query";
import { Suspense, useState, useEffect } from "react";
import api from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { Footer } from "@/components/Footer";
import Link from "next/link";
import { 
  Server, 
  Activity, 
  Database, 
  Clock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Ticket,
  XCircle,
  CheckSquare,
  Zap,
  TrendingUp,
  ArrowUpRight,
  Monitor,
  Shield,
  Search,
  Box,
  Key,
  QrCode,
  History,
  User as UserIcon,
  Globe,
  Lock,
  Copy,
  Check,
  ChevronRight,
  Terminal
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/Skeleton";
import { useSearchParams } from "next/navigation";

function DashboardContent() {
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("search")?.toLowerCase() || "";

  const [copiedIp, setCopiedIp] = useState(null as string | null);

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

  const { data: userProfile } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const response = await api.get("/auth/profile");
      return response.data;
    },
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const response = await api.get("/dashboard/stats");
      return response.data;
    },
  });

  const { data: inventory, isLoading: invLoading } = useQuery({
    queryKey: ["vm-inventory"],
    queryFn: async () => {
      const response = await api.get("/vm-inventory/");
      return response.data;
    },
  });

  const { data: physicalAssets, isLoading: physicalAssetsLoading } = useQuery({
    queryKey: ["physical-assets"],
    queryFn: async () => {
      const response = await api.get("/assets");
      return response.data;
    },
  });

  const { data: credentials, isLoading: credentialsLoading } = useQuery({
    queryKey: ["credentials-list"],
    queryFn: async () => {
      const response = await api.get("/credentials/");
      return response.data;
    },
  });

  const { data: supportTickets, isLoading: supportTicketsLoading } = useQuery({
    queryKey: ["support-tickets-list"],
    queryFn: async () => {
      const response = await api.get("/support-tickets");
      return response.data;
    },
  });

  const { data: vmRequests } = useQuery({
    queryKey: ["vm-requests-list"],
    queryFn: async () => {
      const response = await api.get("/vm/request/");
      return response.data;
    },
  });

  const { data: serviceRequests } = useQuery({
    queryKey: ["service-requests-list"],
    queryFn: async () => {
      const response = await api.get("/service/request/");
      return response.data;
    },
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const res = await api.get("/tasks");
      return res.data;
    }
  });

  const { data: auditLogsResponse, isLoading: auditLogsLoading } = useQuery({
    queryKey: ["dashboard-audit-logs"],
    queryFn: async () => {
      const response = await api.get("/audit/?page=1&limit=5");
      return response.data;
    },
  });

  const auditLogs = auditLogsResponse?.data || [];

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIp(id);
    setTimeout(() => setCopiedIp(null), 2000);
  };

  const getGreeting = () => {
    const hrs = new Date().getHours();
    if (hrs < 12) return "Good morning";
    if (hrs < 18) return "Good afternoon";
    return "Good evening";
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Invalid Format";
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    }) + " • " + date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short'
    });
  };

  // Filter VM Inventory
  const filteredInventory = inventory?.filter((vm: any) => 
    vm.hostname?.toLowerCase().includes(searchQuery) ||
    vm.ipAddress?.toLowerCase().includes(searchQuery) ||
    vm.os?.toLowerCase().includes(searchQuery) ||
    vm.environment?.toLowerCase().includes(searchQuery)
  );

  // Filter Physical Assets
  const filteredPhysicalAssets = physicalAssets?.filter((asset: any) => 
    asset.assetCode?.toLowerCase().includes(searchQuery) ||
    asset.hostname?.toLowerCase().includes(searchQuery) ||
    asset.assetType?.toLowerCase().includes(searchQuery) ||
    asset.location?.toLowerCase().includes(searchQuery)
  );

  // Merge and Filter Tickets
  const allTickets = [
    ...(vmRequests || []).map((t: any) => ({ ...t, type: 'VM_REQUEST', title: `VM Request: ${t.hostname}`, ticketCode: t.ticketId || `VM-${t.id.slice(0,5)}` })),
    ...(serviceRequests || []).map((t: any) => ({ ...t, type: 'SERVICE_REQUEST', title: `Service: ${t.serviceName}`, ticketCode: t.ticketId || `SVC-${t.id.slice(0,5)}` })),
    ...(supportTickets || []).map((t: any) => ({ ...t, type: 'SUPPORT_TICKET', title: t.subject, ticketCode: t.ticketId || `SUP-${t.id.slice(0,5)}` }))
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .filter((t: any) => 
      t.title?.toLowerCase().includes(searchQuery) ||
      t.ticketCode?.toLowerCase().includes(searchQuery) ||
      t.status?.toLowerCase().includes(searchQuery)
    );

  // Filter Audit Logs
  const filteredAuditLogs = auditLogs.filter((log: any) => 
    log.action?.toLowerCase().includes(searchQuery) ||
    log.user?.fullName?.toLowerCase().includes(searchQuery) ||
    log.ipAddress?.includes(searchQuery)
  );

  const activeVMsCount = stats?.inventory?.activeInstances || 0;
  const activeServicesCount = (stats?.inventory?.totalAssets || 0) - activeVMsCount;
  const pendingApprovalsCount = stats?.tickets?.pending || 0;

  const displayStats = [
    { 
      label: "Active VMs", 
      value: activeVMsCount, 
      icon: Server, 
      color: "text-blue-600", 
      bg: "bg-blue-50/70", 
      border: "border-blue-100", 
      shadow: "shadow-blue-500/5", 
      hoverBg: "hover:bg-blue-50/20",
      subtext: "Running Cloud Instances",
      href: "/vm/inventory" 
    },
    { 
      label: "Service Assets", 
      value: activeServicesCount, 
      icon: Box, 
      color: "text-violet-600", 
      bg: "bg-violet-50/70", 
      border: "border-violet-100", 
      shadow: "shadow-violet-500/5", 
      hoverBg: "hover:bg-violet-50/20",
      subtext: "Microservice endpoints",
      href: "/service/inventory" 
    },
    { 
      label: "Credential Vault", 
      value: credentials?.length || 0, 
      icon: Key, 
      color: "text-amber-600", 
      bg: "bg-amber-50/70", 
      border: "border-amber-100", 
      shadow: "shadow-amber-500/5", 
      hoverBg: "hover:bg-amber-50/20",
      subtext: "Secure keys & SSH tokens",
      href: "/credentials" 
    },
    { 
      label: "Pending Approvals", 
      value: pendingApprovalsCount, 
      icon: Clock, 
      color: "text-rose-600", 
      bg: "bg-rose-50/70", 
      border: "border-rose-100", 
      shadow: "shadow-rose-500/5", 
      hoverBg: "hover:bg-rose-50/20",
      subtext: "Tickets awaiting action",
      href: "/tickets" 
    }
  ];

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-600">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        <MobileNav />
        <main className="page-container overflow-y-auto custom-scrollbar">
            {/* Standard Clean Header */}
            <header className="mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <PageHeader 
                  title="Dashboard" 
                  subtitle={
                    <>{getGreeting()}, {userProfile?.fullName?.split(' ')[0] || 'Admin'} • <span className="text-emerald-600 font-semibold">All Systems Operational</span></>
                  } 
                />


            </header>

            {/* 4-Column Metrics Grid (Clean, Simple, Iconless) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
              {statsLoading || credentialsLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm h-32 flex flex-col justify-between animate-pulse">
                      <div className="space-y-2">
                        <Skeleton className="w-16 h-3 rounded" />
                        <Skeleton className="w-8 h-6 rounded" />
                      </div>
                      <Skeleton className="w-24 h-3 rounded" />
                    </div>
                  ))
                : displayStats.map((stat, i) => (
                    <Link href={stat.href} key={stat.label}>
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-slate-200/80 transition-all group flex flex-col justify-between h-32 cursor-pointer"
                      >
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{stat.label}</p>
                          <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-3">{stat.value}</h3>
                        </div>
                        <p className="text-[10px] font-medium text-slate-500 truncate mt-1">{stat.subtext}</p>
                      </motion.div>
                    </Link>
                  ))
              }
            </div>

            {/* Left and Right Main Operations Columns */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                         {/* Left Column: Recent Task Overview */}
              <div className="space-y-8">
                <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm flex flex-col">
                  <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Recent Task Overview
                    </h2>
                    <Link 
                      href="/tasks"
                      className="text-[10px] font-bold text-blue-600 uppercase tracking-wider hover:underline flex items-center gap-1 bg-white border border-slate-200 px-3 py-1.5 rounded-xl transition-all active:scale-95 shadow-sm"
                    >
                      View Tracker <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                  
                  {tasksLoading ? (
                    <div className="divide-y divide-slate-50 p-6 space-y-4">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <Skeleton className="w-32 h-5 rounded-lg" />
                          <Skeleton className="w-16 h-5 rounded-full" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50/80 min-h-[300px]">
                      {tasks && tasks.length > 0 ? (
                        tasks.slice(0, 4).map((task: any) => {
                          const getTaskStatusLabel = (status: string) => {
                            switch (status) {
                              case "NOT_STARTED": return "To Do";
                              case "IN_PROGRESS": return "In Progress";
                              case "COMPLETED": return "Completed";
                              case "BLOCKED": return "On Hold";
                              default: return status;
                            }
                          };

                          const getTaskStatusColor = (status: string) => {
                            switch (status) {
                              case "COMPLETED": return "bg-emerald-50 text-emerald-600 border-emerald-100";
                              case "IN_PROGRESS": return "bg-blue-50 text-blue-600 border-blue-100";
                              case "BLOCKED": return "bg-amber-50 text-amber-600 border-amber-100";
                              default: return "bg-slate-50 text-slate-500 border-slate-100";
                            }
                          };

                          const getTaskPriorityColor = (priority: string) => {
                            switch (priority) {
                              case "HIGH": return "bg-rose-50 text-rose-600 border-rose-100";
                              case "MEDIUM": return "bg-amber-50 text-amber-600 border-amber-100";
                              default: return "bg-slate-50 text-slate-500 border-slate-100";
                            }
                          };

                          return (
                            <div key={task.id} className="flex items-center justify-between p-5 hover:bg-slate-50/20 transition-all group">
                              <div className="flex items-center gap-4 overflow-hidden">
                                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100 shadow-sm shrink-0">
                                  <CheckSquare className="w-5 h-5 text-indigo-500 animate-pulse" />
                                </div>
                                <div className="overflow-hidden">
                                  <p className="text-xs font-bold text-slate-800 truncate group-hover:text-blue-600 transition-colors">{task.title}</p>
                                  <div className="flex flex-wrap items-center gap-2 mt-1">
                                    {task.priority && (
                                      <span className={cn(
                                        "text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider border shadow-sm",
                                        getTaskPriorityColor(task.priority)
                                      )}>
                                        {task.priority}
                                      </span>
                                    )}
                                    {task.dueDate && (
                                      <>
                                        <span className="text-[9px] text-slate-300 font-bold">•</span>
                                        <span className="text-[9px] text-slate-400 font-bold uppercase">Due {formatDate(task.dueDate)}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-3 shrink-0">
                                <span className={cn(
                                  "inline-flex items-center px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase tracking-wider border shadow-sm",
                                  getTaskStatusColor(task.status)
                                )}>
                                  {getTaskStatusLabel(task.status)}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="py-24 text-center">
                          <CheckSquare className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">No Recent Tasks Found</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Support Tickets & Audit Ledger */}
              <div className="space-y-8">
                
                {/* Combined Support & Service Requests */}
                <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm flex flex-col">
                  <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Recent Operations & Support Tickets
                    </h2>
                    <Link 
                      href="/tickets"
                      className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider hover:underline flex items-center gap-1 bg-white border border-slate-200 px-3 py-1.5 rounded-xl transition-all active:scale-95 shadow-sm"
                    >
                      View All Tickets <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  {supportTicketsLoading ? (
                    <div className="divide-y divide-slate-50 p-6 space-y-4">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <Skeleton className="w-32 h-5 rounded-lg" />
                          <Skeleton className="w-16 h-5 rounded-full" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50/80 min-h-[300px]">
                      {allTickets && allTickets.length > 0 ? (
                        allTickets.slice(0, 4).map((ticket: any) => {
                          const lastViewedAt = ticketViews[ticket.id];
                          const isNew = !lastViewedAt && (new Date().getTime() - new Date(ticket.createdAt).getTime() < 24 * 60 * 60 * 1000);
                          const lastCommentTime = ticket.comments && ticket.comments.length > 0
                            ? new Date(ticket.comments[ticket.comments.length - 1].createdAt).getTime()
                            : new Date(ticket.createdAt).getTime();

                          let isUnread = false;
                          if (ticket.status === 'OPEN' || ticket.status === 'PENDING') {
                            const isCreator = ticket.requestedBy === userProfile?.id || ticket.requestedById === userProfile?.id;
                            if (isCreator) {
                              const hasOtherComments = ticket.comments && ticket.comments.some((c: any) => c.authorId !== userProfile?.id);
                              if (hasOtherComments) {
                                isUnread = !lastViewedAt || lastCommentTime > lastViewedAt;
                              }
                            } else {
                              isUnread = !lastViewedAt || lastCommentTime > lastViewedAt;
                            }
                          }

                          return (
                            <div key={ticket.id} className="flex items-center justify-between p-5 hover:bg-slate-50/20 transition-all group">
                              <div className="flex items-center gap-4 overflow-hidden">
                                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100 shadow-sm shrink-0">
                                  {ticket.type === 'VM_REQUEST' ? <Server className="w-5 h-5 text-blue-500" /> :
                                   ticket.type === 'SERVICE_REQUEST' ? <Box className="w-5 h-5 text-indigo-500" /> :
                                   <Ticket className="w-5 h-5 text-amber-500" />}
                                </div>
                                <div className="overflow-hidden">
                                  <div className="flex items-center gap-2 overflow-hidden">
                                    <p className="text-xs font-bold text-slate-800 truncate group-hover:text-indigo-600 transition-colors">{ticket.title}</p>
                                    {isNew && (
                                      <span className="text-[8px] font-extrabold px-1.5 py-0.5 bg-emerald-500 text-white rounded shrink-0 shadow-sm uppercase tracking-wider">
                                        NEW
                                      </span>
                                    )}
                                    {isUnread && (
                                      <span className="text-[8px] font-extrabold px-1.5 py-0.5 bg-amber-500 text-white rounded shrink-0 shadow-sm uppercase tracking-wider">
                                        UNREAD
                                      </span>
                                    )}
                                  </div>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-tighter">
                                    {ticket.ticketCode}
                                  </span>
                                  <span className={cn(
                                    "text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider",
                                    ticket.type === 'VM_REQUEST' ? "bg-blue-50 text-blue-600" :
                                    ticket.type === 'SERVICE_REQUEST' ? "bg-purple-50 text-purple-600" :
                                    "bg-amber-50 text-amber-600"
                                  )}>
                                    {ticket.type.replace('_', ' ')}
                                  </span>
                                  <span className="text-[9px] text-slate-300 font-bold">•</span>
                                  <span className="text-[9px] text-slate-400 font-bold uppercase">{formatDate(ticket.createdAt)}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <span className={cn(
                                "inline-flex items-center px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase tracking-wider border shadow-sm",
                                ticket.status === 'APPROVED' || ticket.status === 'COMPLETED' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                ticket.status === 'REJECTED' || ticket.status === 'FAILED' ? "bg-rose-50 text-rose-600 border-rose-100" :
                                ticket.status === 'PENDING' || ticket.status === 'OPEN' ? "bg-amber-50 text-amber-600 border-amber-100 animate-pulse" :
                                "bg-slate-100 text-slate-500 border-slate-200"
                              )}>
                                {ticket.status}
                              </span>
                            </div>
                          </div>
                        );
                      })
                      ) : (
                        <div className="py-24 text-center">
                          <Search className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">No Operational Tickets Found</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </div>

            </div>
        </main>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
