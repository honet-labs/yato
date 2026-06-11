"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  LayoutDashboard, 
  Ticket,
  Server, 
  Box, 
  Key, 
  History, 
  Users, 
  Settings,
  Terminal,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Layers,
  Activity,
  Bell,
  QrCode,
  CheckSquare,
  HardDrive,
  Plug,
  Coffee,
  Loader2,
  Clock,
  Calendar,
  ArrowLeftRight,
  Shield,
  Coins,
  Edit,
  Languages
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { useBranding } from "@/context/branding-context";
import { useLanguage } from "@/context/language-context";
import { Footer } from "./Footer";


const formatNotificationTime = (dateStr: string) => {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch (e) {
    return "";
  }
};

interface SidebarProps {
  isMobile?: boolean;
  onNavItemClick?: () => void;
}

export function Sidebar({ isMobile, onNavItemClick }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { appName, appLogo } = useBranding();
  const { lang, setLang, t } = useLanguage();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState({} as Record<string, boolean>);
  const profileRef = useRef<HTMLDivElement>(null);

  const toggleSection = (title: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [title]: !prev[title]
    }));
  };

  const { data: profile } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const response = await api.get("/auth/profile");
      return response.data;
    },
  });

  const { data: notifications, isLoading: isLoadingNotifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const response = await api.get("/notifications");
      return response.data;
    },
    refetchInterval: 15000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.post("/notifications/read-all"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const { data: sidebarTasks } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      try {
        const response = await api.get("/tasks");
        return response.data;
      } catch (err) {
        return [];
      }
    },
    refetchInterval: 15000,
  });

  const notStartedTasksCount = (sidebarTasks || []).filter((t: any) => t.status === "NOT_STARTED").length || 0;

  const unreadCount = (notifications?.data || []).filter((n: any) => !n.isRead).length || 0;
  const ticketUnreadCount = (notifications?.data || []).filter((n: any) => !n.isRead && n.link?.includes("/tickets")).length || 0;
  const displayNotifications = notifications?.data || [];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem("yato_token");
    router.push("/login");
  };

  const userRoles = profile?.roles?.map((ur: any) => ur.role?.name).filter(Boolean) || [];
  const userPermissions = profile?.roles?.flatMap((ur: any) => ur.role?.permissions || []) || [];
  const isAdmin = userRoles.some((role: string) => 
    ["ADMIN", "SYSTEM ADMIN", "SYSTEM_ADMIN", "SUPERADMIN"].includes(role.toUpperCase())
  );

  const hasPermission = (permission?: string) => {
    if (!permission) return true;
    if (isAdmin) return true;
    if (permission === "VIEW_HRM_ADMIN_PANEL") {
      return (
        userPermissions.includes("VIEW_HRM_ADMIN_PANEL") ||
        userPermissions.includes("MANAGE_HRM") ||
        userPermissions.includes("MANAGE_HRM_ATTENDANCE") ||
        userPermissions.includes("MANAGE_HRM_LEAVES")
      );
    }
    if (permission === "MANAGE_HRM_DIVISIONS") {
      return userPermissions.includes("MANAGE_HRM_DIVISIONS") || userPermissions.includes("MANAGE_HRM");
    }
    if (permission === "MANAGE_HRM_SCHEDULER") {
      return userPermissions.includes("MANAGE_HRM_SCHEDULER") || userPermissions.includes("MANAGE_HRM");
    }
    if (permission === "MANAGE_HRM_ADJUSTMENTS") {
      return userPermissions.includes("MANAGE_HRM_ADJUSTMENTS") || userPermissions.includes("MANAGE_HRM");
    }
    return userPermissions.includes(permission);
  };

  const sections = [
    {
      title: "Main Menu",
      items: [
        { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard", permission: "VIEW_DASHBOARD" },
        { icon: Ticket, label: "Support Tickets", href: "/tickets", permission: "VIEW_SUPPORT_TICKETS" },
        { icon: HardDrive, label: "File Manager", href: "/files" },
      ]
    },
    {
      title: "Productivity",
      items: [
        { icon: CheckSquare, label: "Tasks Tracker", href: "/tasks" },
        { icon: Edit, label: "Notes & Schedule", href: "/notes" },
        { icon: Calendar, label: "PMO Calendar", href: "/pmo-calendar", permission: "VIEW_PMO_CALENDAR" },
      ]
    },
    {
      title: "Attendance & Timesheet",
      items: [
        { icon: Clock, label: "Attendance", href: "/hrm/attendance" },
        { icon: Coffee, label: "Leave Hub", href: "/hrm/leaves" },
      ]
    },
    {
      title: "Management Admin",
      items: [
        { icon: Shield, label: "Management Admin Panel", href: "/hrm/admin-panel", permission: "VIEW_HRM_ADMIN_PANEL" },
        { icon: Shield, label: "Division Mappings", href: "/hrm/divisions", permission: "MANAGE_HRM_DIVISIONS" },
        { icon: Calendar, label: "Shift Scheduler", href: "/hrm/scheduler", permission: "MANAGE_HRM_SCHEDULER" },
        { icon: Edit, label: "Attendance Adjust", href: "/hrm/adjustments", permission: "MANAGE_HRM_ADJUSTMENTS" },
      ]
    },
    {
      title: "Infrastructure",
      items: [
        { icon: Server, label: "VM Instances", href: "/vm/inventory", permission: "VIEW_VM_INVENTORY" },
        { icon: Layers, label: "Service Assets", href: "/service/inventory", permission: "VIEW_SERVICE_INVENTORY" },
        { icon: Key, label: "Credential Vault", href: "/credentials", permission: "VIEW_CREDENTIALS" },
      ]
    },
    {
      title: "Infra Management",
      items: [
        { icon: Server, label: "VM Inventory", href: "/admin/vm-inventory", permission: "MANAGE_VM_INVENTORY" },
        { icon: Layers, label: "Service Assets Inventory", href: "/admin/service-inventory", permission: "MANAGE_SERVICE_INVENTORY" },
        { icon: QrCode, label: "Asset Registry", href: "/assets", permission: "VIEW_ASSETS" },
      ]
    },
    {
      title: "System Control",
      items: [
        { icon: Activity, label: "System Status", href: "/admin/status", permission: "VIEW_SYSTEM_STATUS" },
        { icon: History, label: "Log Activity", href: "/audit", permission: "VIEW_AUDIT_LOGS" },
        { icon: Users, label: "User Management", href: "/admin/users", permission: "MANAGE_USERS" },
        { icon: ShieldCheck, label: "Access Control", href: "/admin/roles", permission: "MANAGE_ROLES" },
        { icon: Settings, label: "Platform Settings", href: "/admin/config", permission: "MANAGE_CONFIG" },
        { icon: Plug, label: "Integration Hub", href: "/admin/integrations", permission: "MANAGE_CONFIG" },
      ]
    }
  ];

  const filteredSections = sections.map(section => ({
    ...section,
    items: section.items.filter(item => hasPermission(item.permission))
  })).filter(section => section.items.length > 0);

  return (
    <>
      <aside className={cn(
        "w-60 bg-white h-screen flex flex-col shrink-0 border-r border-slate-100 z-50 sticky top-0 pb-10",
        !isMobile && "lg:flex hidden"
      )}>
      <div className="p-6 flex items-center gap-2.5">
        {appLogo ? (
          <img src={appLogo} alt="Logo" className="w-8 h-8 object-contain rounded-lg shadow-sm" />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Box className="w-5 h-5 text-white" />
          </div>
        )}
        <span className="font-bold text-lg text-slate-900 tracking-tight">{appName}</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto custom-scrollbar">
        {filteredSections.map((section: any) => {
          const isCollapsed = collapsedSections[section.title] || false;
          return (
            <div key={section.title} className="space-y-1.5">
              <button 
                onClick={() => toggleSection(section.title)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-50/50 rounded-lg uppercase tracking-widest transition-all cursor-pointer group"
              >
                <span>{t(section.title)}</span>
                <ChevronRight className={cn(
                  "w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-transform duration-200",
                  !isCollapsed && "rotate-90"
                )} />
              </button>
              
              <AnimatePresence initial={false}>
                {!isCollapsed && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="space-y-1 overflow-hidden"
                  >
                    {section.items.map((item: any) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => onNavItemClick?.()}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group cursor-pointer",
                          pathname === item.href 
                            ? "bg-blue-50 text-blue-600 shadow-sm" 
                            : "text-slate-500 hover:bg-slate-50/80 hover:text-slate-900"
                        )}
                      >
                        <item.icon className={cn("w-4 h-4", pathname === item.href ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600")} />
                        <span className="font-semibold text-[13px] tracking-tight">{t(item.label)}</span>
                        {item.href === "/tickets" && ticketUnreadCount > 0 && (
                          <span className="ml-auto flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-sm shadow-rose-500/25 animate-pulse shrink-0">
                            {ticketUnreadCount}
                          </span>
                        )}
                        {item.href === "/tasks" && notStartedTasksCount > 0 && (
                          <span className="ml-auto flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-sm shadow-rose-500/25 animate-pulse shrink-0">
                            {notStartedTasksCount}
                          </span>
                        )}
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-100 bg-slate-50/30">
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex items-center gap-2">
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className={cn(
                  "p-2.5 text-slate-400 hover:text-slate-600 transition-colors rounded-xl hover:bg-white border border-transparent hover:border-slate-100 shadow-sm hover:shadow-md",
                  showNotifications && "bg-white border-slate-100 text-slate-900 shadow-md"
                )}
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white animate-pulse" />
                )}
              </button>

            <AnimatePresence>
              {showNotifications && (
                <motion.div 
                  initial={{ opacity: 0, x: 20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 20, scale: 0.95 }}
                  className="absolute bottom-14 left-0 w-[290px] sm:w-[420px] bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-[100]"
                >
                    <div className="p-5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="text-[14px] font-extrabold text-slate-900 uppercase tracking-widest">{t("Notifications")}</h3>
                    {unreadCount > 0 && (
                      <button 
                        onClick={() => markAllReadMutation.mutate()}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-700 uppercase"
                      >
                        {t("Mark all as read")}
                      </button>
                    )}
                  </div>
                  <div className="max-h-[480px] overflow-y-auto custom-scrollbar">
                    {isLoadingNotifications ? (
                      <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-200" /></div>
                    ) : displayNotifications?.length === 0 ? (
                      <div className="p-10 text-center">
                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                          <Bell className="w-6 h-6 text-slate-200" />
                        </div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{t("No New Alerts")}</p>
                      </div>
                    ) : (
                      displayNotifications?.map((n: any) => {
                        // Strip "Link: ..." text from message to keep it clean and simple
                        const cleanMsg = (n.message || "").split("Link:")[0].trim();
                        
                        // Parse absolute link URLs to relative paths for fast Next.js client-side navigation
                        let targetLink = n.link;
                        if (targetLink && targetLink.startsWith("http")) {
                          try {
                            const urlObj = new URL(targetLink);
                            targetLink = urlObj.pathname + urlObj.search;
                          } catch (e) {
                            // fallback
                          }
                        }

                        return (
                          <div 
                            key={n.id}
                            className={cn("p-5 border-b border-slate-50 hover:bg-slate-50 transition-all cursor-pointer", !n.isRead && "bg-blue-50/30")}
                            onClick={() => {
                              if (!n.isRead) markReadMutation.mutate(n.id);
                              if (targetLink) router.push(targetLink);
                              setShowNotifications(false);
                            }}
                          >
                            <div className="flex gap-4">
                              <div className="mt-1">
                                {n.type === 'SUCCESS' ? <div className="w-2 h-2 bg-emerald-500 rounded-full" /> : <div className="w-2 h-2 bg-blue-500 rounded-full" />}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-start justify-between gap-3 mb-1.5">
                                  <p className="text-[14px] font-bold text-slate-900 leading-tight">{n.title}</p>
                                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{formatNotificationTime(n.createdAt)}</span>
                                </div>
                                <p className="text-[13px] text-slate-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: cleanMsg }} />
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Language Switcher Button */}
          <button 
            onClick={() => setLang(lang === "EN" ? "ID" : "EN")}
            className="px-2 py-1.5 text-[9px] font-black text-slate-500 hover:text-slate-800 transition-all rounded-lg bg-slate-100/50 hover:bg-white border border-slate-100/30 hover:border-slate-250 shadow-sm active:scale-95 flex items-center gap-1.5 cursor-pointer shrink-0"
            title={lang === "EN" ? "Switch to Indonesian" : "Ubah ke Bahasa Inggris"}
          >
            <Languages className="w-3.5 h-3.5 text-blue-600" />
            <span className="tracking-widest">{lang}</span>
          </button>
        </div>
          
          {/* Theme/Other Quick Actions could go here */}
          <div className="w-px h-4 bg-slate-200" />
          <p className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter italic">YATO v1.0</p>
        </div>

        <div className="relative" ref={profileRef}>
          <button 
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-2xl transition-all group border",
              showProfileMenu 
                ? "bg-white shadow-lg border-indigo-100" 
                : "bg-white/50 hover:bg-white border-transparent hover:shadow-md hover:border-slate-100"
            )}
          >
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-lg shadow-slate-900/20 group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <div className="flex-1 text-left overflow-hidden">
              <p className="text-[12px] font-bold text-slate-900 truncate tracking-tight">{profile?.fullName || t('Administrator')}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 truncate">
                {profile?.roles && profile.roles.length > 0 
                  ? profile.roles.map((ur: any) => ur.role.name).join(', ') 
                  : t('NO ROLES')}
              </p>
            </div>
            <ChevronRight className={cn("w-4 h-4 text-slate-300 transition-transform", showProfileMenu && "rotate-90")} />
          </button>

          <AnimatePresence>
            {showProfileMenu && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute bottom-[calc(100%+12px)] left-0 right-0 bg-white rounded-[2rem] shadow-2xl border border-slate-100 p-3 z-[100]"
              >
                <div className="px-5 py-4 mb-3 border-b border-slate-50 bg-slate-50/50 rounded-2xl">
                  <p className="text-[11px] font-bold text-slate-900 leading-tight truncate">{profile?.fullName || t('Administrator')}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase truncate mt-1">{profile?.email || 'admin@yato.local'}</p>
                </div>
                <div className="space-y-1">
                  <Link 
                    href="/profile" 
                    onClick={() => setShowProfileMenu(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 rounded-xl transition-all"
                  >
                    <Users className="w-4 h-4" />
                    {t("ACCOUNT SETTINGS")}
                  </Link>
                  <Link 
                    href="/profile/security" 
                    onClick={() => setShowProfileMenu(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 rounded-xl transition-all"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    {t("SECURITY & MFA")}
                  </Link>
                  <div className="h-px bg-slate-100/50 my-2 mx-2" />
                  <button 
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-[11px] font-bold text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                  >
                    <LogOut className="w-4 h-4" />
                    {t("SIGN OUT")}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      </aside>
      <Footer />
    </>
  );
}
