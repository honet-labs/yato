"use client";
import { PageHeader } from "@/components/PageHeader";
import { SecurePasswordDisplay } from "@/components/SecurePasswordDisplay";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { Pagination } from "@/components/Pagination";
import { 
  Search, 
  Filter, 
  MoreVertical, 
  Terminal, 
  Loader2, 
  Monitor, 
  Plus, 
  HardDrive, 
  Cpu, 
  Database, 
  CheckCircle2, 
  Shield, 
  Trash2, 
  ExternalLink,
  X,
  Copy,
  Check,
  Globe,
  User as UserIcon,
  ShieldAlert,
  Zap,
  Activity,
  Download,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertTriangle
} from "lucide-react";
import { exportToCSV } from "@/lib/csvHelper";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useIsAdmin } from "@/hooks/useIsAdmin";

import { cn } from "@/lib/utils";

interface VM {
  id: string;
  hostname: string;
  ip: string;
  os: string;
  cpu: number;
  ram: number;
  disk: number;
  status: string;
  sshUser?: string;
  sshPassword?: string;
  sshPort?: number;
  requestedBy?: string;
  environment?: string;
  notes?: string;
  ticketId?: string;
}

export default function VmInventoryPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeMenu, setActiveMenu] = useState(null as string | null);
  
  // Modals
  const [showConsole, setShowConsole] = useState(null as VM | null);
  const [isCopied, setIsCopied] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Password verification states
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [verifyPassword, setVerifyPassword] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [failedVerifyAttempts, setFailedVerifyAttempts] = useState(0);
  const [verifyPurpose, setVerifyPurpose] = useState("REVEAL" as "REVEAL" | "COPY" | "COPY_USER");
  const [pendingRevealVm, setPendingRevealVm] = useState(null as VM | null);
  const [revealedPasswords, setRevealedPasswords] = useState({} as Record<string, string>);
  const [showPassInConsole, setShowPassInConsole] = useState(false);
  
  const [addFormData, setAddFormData] = useState({
    hostname: "",
    environment: "Production",
    osTemplate: "",
    cpu: 2,
    ram: 4,
    disk: 50,
    notes: "",
    ipAddress: "",
    sshUser: "root",
    sshPassword: "",
    sshPort: 22
  });

  const terminateMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/vm-inventory/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vm-inventory"] });
      setActiveMenu(null);
    },
  });

  const { isAdmin, permissions, isLoading: isAuthLoading } = useIsAdmin();
  const canView = isAdmin || permissions.includes("VIEW_VM_INVENTORY") || permissions.includes("MANAGE_VM_INVENTORY");
  const canEdit = isAdmin || permissions.includes("EDIT_VM_INVENTORY") || permissions.includes("MANAGE_VM_INVENTORY");
  const canAddVm = isAdmin || permissions.includes("PROVISION_VM");

  const { data: osTemplates } = useQuery({
    queryKey: ["catalog", "OS_TEMPLATE"],
    queryFn: async () => {
      const response = await api.get("/catalog?category=OS_TEMPLATE");
      return response.data;
    },
  });

  useEffect(() => {
    if (osTemplates && osTemplates.length > 0 && !addFormData.osTemplate) {
      setAddFormData(prev => ({ ...prev, osTemplate: osTemplates[0].name }));
    }
  }, [osTemplates]);

  const addMutation = useMutation({
    mutationFn: (newVm: any) => api.post("/vm-inventory", newVm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vm-inventory"] });
      setIsAddModalOpen(false);
      setAddFormData({
        hostname: "",
        environment: "Production",
        osTemplate: osTemplates && osTemplates.length > 0 ? osTemplates[0].name : "",
        cpu: 2,
        ram: 4,
        disk: 50,
        notes: "",
        ipAddress: "",
        sshUser: "root",
        sshPassword: "",
        sshPort: 22
      });
    }
  });

  const { data: inventory, isLoading } = useQuery({
    queryKey: ["vm-inventory"],
    queryFn: async () => {
      const response = await api.get("/vm-inventory/");
      return response.data;
    },
  });

  const handleExport = () => {
    if (!filteredInventory) return;
    const exportData = filteredInventory.map(vm => ({
      'Ticket ID': vm.ticketId,
      'Hostname': vm.hostname,
      'IP Address': vm.ip,
      'OS': vm.os,
      'CPU': `${vm.cpu} vCPU`,
      'RAM': `${vm.ram} GB`,
      'Disk': `${vm.disk} GB`,
      'Environment': vm.environment,
      'Status': vm.status,
      'Owner': vm.requestedBy,
      'Notes': vm.notes
    }));
    exportToCSV(exportData, 'YATO_VM_Inventory');
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  const filteredInventory = inventory?.filter(vm => 
    vm.hostname.toLowerCase().includes(search.toLowerCase()) ||
    vm.ip?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const totalPages = Math.ceil(filteredInventory.length / itemsPerPage);
  const paginatedInventory = filteredInventory.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleRevealVmPassword = async (vm: VM, purpose: "REVEAL" | "COPY" | "COPY_USER") => {
    const isRevealed = vm.id in revealedPasswords;
    if (isRevealed) {
      const revealed = revealedPasswords[vm.id];
      if (purpose === "REVEAL") {
        if (showConsole?.id === vm.id) {
          setShowPassInConsole(!showPassInConsole);
        } else {
          setShowPassInConsole(true);
          setShowConsole(vm);
        }
      } else if (purpose === "COPY_USER") {
        copyToClipboard(vm.sshUser || 'root');
      } else if (revealed) {
        copyToClipboard(revealed);
      }
    } else {
      setPendingRevealVm(vm);
      setVerifyPurpose(purpose);
      setVerifyPassword("");
      setVerifyError("");
      setIsVerifyModalOpen(true);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (isAuthLoading || isLoading) {
    return (
      <div className="flex min-h-screen bg-slate-50 items-center justify-center p-6">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto" />
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading VM Assets...</p>
        </div>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="flex min-h-screen bg-slate-50 items-center justify-center p-6">
        <div className="text-center space-y-5 max-w-sm">
          <div className="w-20 h-20 bg-rose-500/10 rounded-full border border-rose-500/30 flex items-center justify-center mx-auto mb-6 text-rose-500">
            <Lock className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">Access Denied</h2>
          <p className="text-sm text-slate-500">You do not have permission to access the VM Inventory.</p>
          <div className="pt-2">
            <Link 
              href="/dashboard" 
              className="inline-flex items-center justify-center px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        <MobileNav />
        <main className="page-container overflow-y-auto custom-scrollbar">
          <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <PageHeader title="VM Inventory" subtitle="Infrastructure asset registry and orchestration status" />
              </div>
              {canAddVm && (
                <div className="flex gap-3 md:ml-auto">
                  <button 
                    onClick={() => setIsAddModalOpen(true)}
                    className="btn-primary flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add VM
                  </button>
                </div>
              )}
            </header>

            <div className="flex flex-col md:flex-row gap-4 mb-8">
              <div className="relative flex-1 group">
                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input 
                  type="text" 
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all placeholder:text-slate-400 placeholder:font-medium" 
                  placeholder="Search hostname..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button 
                onClick={handleExport}
                className="bg-white border border-slate-200 text-slate-600 px-6 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              <button className="bg-white border border-slate-200 text-slate-600 px-6 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filter
              </button>
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-visible">
              <div className="overflow-x-auto min-h-[400px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Hostname</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">IP Address</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">OS</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Specifications</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">Environment</th>
                      <th className="px-6 py-4 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {isLoading ? (
                      [...Array(3)].map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          <td colSpan={6} className="px-6 py-8 h-20 bg-slate-50/30"></td>
                        </tr>
                      ))
                    ) : paginatedInventory?.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-20 text-center text-slate-400 font-medium">
                          No active instances found.
                        </td>
                      </tr>
                    ) : paginatedInventory?.map((vm) => (
                      <tr key={vm.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 shadow-sm">
                              <Monitor className="w-5 h-5" />
                            </div>
                            <p className="font-bold text-slate-900 text-[14px]">{vm.hostname}</p>
                          </div>
                        </td>
                        <td className="px-6 py-6">
                          <div className="flex items-center gap-2">
                            <code className="text-[11px] font-mono text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{vm.ip || 'Pending...'}</code>
                            {vm.ip && (
                              <button 
                                onClick={() => copyToClipboard(vm.ip)}
                                className="p-1 hover:bg-slate-50 rounded-md text-slate-400 hover:text-blue-600 transition-all border border-transparent hover:border-slate-100"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-6">
                          <span className="text-[12px] font-bold text-slate-600 uppercase">{vm.os || 'N/A'}</span>
                        </td>
                        <td className="px-6 py-6">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5">
                              <Cpu className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-[11px] font-bold text-slate-600">{vm.cpu} vCPU</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Database className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-[11px] font-bold text-slate-600">{vm.ram}GB</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-[11px] font-bold text-slate-600">{vm.disk}GB</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-6 text-center">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-widest border shadow-sm",
                            vm.environment?.toUpperCase() === 'PRODUCTION' ? "bg-rose-50 text-rose-600 border-rose-100" :
                            vm.environment?.toUpperCase() === 'STAGING' ? "bg-blue-50 text-blue-600 border-blue-100" :
                            "bg-slate-50 text-slate-600 border-slate-100"
                          )}>
                            <div className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              vm.environment?.toUpperCase() === 'PRODUCTION' ? "bg-rose-500" :
                              vm.environment?.toUpperCase() === 'STAGING' ? "bg-blue-500" :
                              "bg-slate-400"
                            )} />
                            {vm.environment?.toUpperCase() === 'PRODUCTION' ? 'PRODUCTION (DC)' : (vm.environment || 'DEVELOPMENT')}
                          </span>
                        </td>
                        <td className="px-6 py-6 text-right relative">
                          <div className="flex items-center justify-end gap-1">
                            <button 
                              onClick={() => handleRevealVmPassword(vm, "REVEAL")}
                              className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                              title="View Credentials"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenu(activeMenu === vm.id ? null : vm.id);
                              }}
                              className={cn(
                                "p-2.5 rounded-lg transition-all hover:bg-white hover:shadow-md border border-transparent hover:border-slate-100 relative z-20",
                                activeMenu === vm.id ? "bg-white shadow-md border-slate-100 text-blue-600" : "text-slate-400"
                              )}
                            >
                              <MoreVertical className="w-5 h-5" />
                            </button>
                          </div>

                          <AnimatePresence>
                            {activeMenu === vm.id && (
                              <motion.div 
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                className="absolute right-6 top-[80%] w-48 bg-white rounded-xl shadow-2xl border border-slate-100 p-2 z-[100]"
                              >
                                <button 
                                  onClick={() => { handleRevealVmPassword(vm, "REVEAL"); setActiveMenu(null); }}
                                  className="w-full flex items-center gap-3 px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-lg transition-all"
                                >
                                  <Terminal className="w-4 h-4" />
                                  CONSOLE ACCESS
                                </button>

                                <div className="h-px bg-slate-50 my-1" />
                                {canEdit && (
                                  <button 
                                    onClick={() => {
                                      if (confirm(`Are you sure you want to TERMINATE ${vm.hostname}?`)) {
                                        terminateMutation.mutate(vm.id);
                                      }
                                    }}
                                    disabled={terminateMutation.isPending}
                                    className="w-full flex items-center gap-3 px-3 py-2 text-[11px] font-bold text-rose-500 hover:bg-rose-50 rounded-lg transition-all disabled:opacity-50"
                                  >
                                    {terminateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                    TERMINATE
                                  </button>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination 
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={filteredInventory.length}
                itemsPerPage={itemsPerPage}
              />
            </div>
        </main>
      </div>

      {/* Console Access Modal */}
      <AnimatePresence>
        {showConsole && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#1e1e1e] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-white/10"
            >
              <div className="p-5 border-b border-white/5 flex items-center justify-between bg-[#252525]">
                <div className="flex items-center gap-3">
                  <Terminal className="w-5 h-5 text-emerald-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-widest">Interactive Console Session — {showConsole.hostname}</span>
                </div>
                <button onClick={() => { setShowConsole(null); setShowPassInConsole(false); }} className="text-white/40 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-8 space-y-8">
                <div className="font-mono text-[13px] text-emerald-400/90 space-y-2 bg-black/40 p-6 rounded-xl border border-white/5 shadow-inner">
                  <p className="text-white/40 mb-4 tracking-tighter"># System established {new Date().toLocaleString()}</p>
                  <p>$ ssh {revealedPasswords[showConsole.id] && showPassInConsole ? (showConsole.sshUser || 'root') : '••••••••'}@{showConsole.ip || 'pending'} -p {showConsole.sshPort || 22}</p>
                  <p>Authenticating with encrypted keys...</p>
                  <p className="text-emerald-500 font-bold">✓ Secure session established.</p>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">IP Address</p>
                        <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                          <span className="text-[13px] font-bold text-white">{showConsole.ip || '0.0.0.0'}</span>
                          <button onClick={() => copyToClipboard(showConsole.ip || '')} className="text-white/20 hover:text-white">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Port</p>
                        <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                          <span className="text-[13px] font-bold text-white">{showConsole.sshPort || 22}</span>
                          <button onClick={() => copyToClipboard((showConsole.sshPort || 22).toString())} className="text-white/20 hover:text-white">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Username</p>
                      <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                        <span className="text-[13px] font-bold text-white">
                          {revealedPasswords[showConsole.id] && showPassInConsole ? (showConsole.sshUser || 'root') : '••••••••'}
                        </span>
                        <button 
                          onClick={() => {
                            if (revealedPasswords[showConsole.id]) {
                              copyToClipboard(showConsole.sshUser || 'root');
                            } else {
                              handleRevealVmPassword(showConsole, "COPY_USER");
                            }
                          }} 
                          className="text-white/20 hover:text-white"
                          title="Copy Username"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">Password</p>
                      <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                        <SecurePasswordDisplay
                          itemId={showConsole.id}
                          maskedPlaceholder="••••••••••••"
                          revealedPassword={revealedPasswords[showConsole.id]}
                          isVisible={showPassInConsole}
                          onToggleVisibility={() => setShowPassInConsole(!showPassInConsole)}
                          onRevealRequest={() => handleRevealVmPassword(showConsole, "REVEAL")}
                          theme="dark"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-6 border border-white/5 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                      <ShieldAlert className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-white uppercase tracking-normal">Direct Web Console</p>
                      <p className="text-[10px] text-white/40 font-medium mt-1 leading-relaxed">Integrated xterm.js gateway is currently in read-only mode for this instance.</p>
                    </div>
                    <button 
                      onClick={() => window.open(`/vm/terminal/${showConsole.id}`, '_blank', 'width=1000,height=600')}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-bold uppercase transition-all shadow-lg shadow-emerald-600/20"
                    >
                      Launch Full Terminal
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3">
                  <Activity className="w-5 h-5 text-amber-500" />
                  <p className="text-[11px] font-medium text-amber-200/80">Make sure your local environment has allowed outgoing traffic on port {showConsole.sshPort || 22}.</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Identity Verification Modal */}
      <AnimatePresence>
        {isVerifyModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm border border-slate-100"
            >
              <div className="p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-5">
                  <ShieldCheck className="w-8 h-8 text-amber-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">Identity Verification</h3>
                <p className="text-[11px] font-medium text-slate-400 mb-6">
                  Enter your account password to reveal this secret
                </p>
                
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!verifyPassword.trim()) return;
                  if (!pendingRevealVm) return;

                  setIsVerifying(true);
                  setVerifyError("");
                  try {
                    const res = await api.post(`/vm-inventory/${pendingRevealVm.id}/reveal`, { password: verifyPassword });
                    
                    const vmForAction = pendingRevealVm;
                    setRevealedPasswords(prev => ({
                      ...prev,
                      [vmForAction.id]: res.data.sshPassword || null
                    }));
                    setIsVerifyModalOpen(false);
                    setPendingRevealVm(null);
                    setVerifyPassword("");
                    setFailedVerifyAttempts(0);
                    
                    if (verifyPurpose === "REVEAL") {
                      setShowPassInConsole(true);
                      setShowConsole(vmForAction);
                    } else if (verifyPurpose === "COPY_USER") {
                      copyToClipboard(vmForAction.sshUser || 'root');
                    } else {
                      copyToClipboard(res.data.sshPassword || '');
                    }
                  } catch (err: any) {
                    const nextAttempts = failedVerifyAttempts + 1;
                    setFailedVerifyAttempts(nextAttempts);
                    
                    if (nextAttempts >= 3) {
                      setFailedVerifyAttempts(0);
                      setIsVerifyModalOpen(false);
                      localStorage.removeItem("yato_token");
                      window.location.href = "/login";
                    } else {
                      const attemptsRemaining = 3 - nextAttempts;
                      setVerifyError(`Invalid password. ${attemptsRemaining} attempt${attemptsRemaining > 1 ? 's' : ''} remaining before logout.`);
                    }
                  } finally {
                    setIsVerifying(false);
                  }
                }} className="space-y-4">
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="password"
                      autoFocus
                      required
                      placeholder="Enter your password..."
                      value={verifyPassword}
                      onChange={(e) => { setVerifyPassword(e.target.value); setVerifyError(""); }}
                      className={cn(
                        "input-field pl-12 w-full py-3 bg-slate-50/50 font-medium text-center",
                        verifyError && "!border-red-300 !ring-red-100"
                      )}
                      autoComplete="current-password"
                    />
                  </div>
                  
                  {verifyError && (
                    <motion.div 
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 text-red-600 text-[11px] font-bold bg-red-50 px-4 py-2.5 rounded-xl border border-red-100"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      {verifyError}
                    </motion.div>
                  )}
                  
                  <div className="flex gap-3 pt-2">
                    <button 
                      type="button"
                      onClick={() => { setIsVerifyModalOpen(false); setVerifyPassword(""); setVerifyError(""); }}
                      className="btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      disabled={isVerifying || !verifyPassword.trim()}
                      className="btn-primary flex-1 flex items-center justify-center gap-2"
                    >
                      {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                      <span className="text-[11px] font-bold uppercase tracking-wider">Verify & Reveal</span>
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/80 overflow-y-auto py-12">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-xl shadow-blue-600/20">
                    <Monitor className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 tracking-tight">Add Virtual Machine</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Provision direct inventory entry</p>
                  </div>
                </div>
                <button onClick={() => setIsAddModalOpen(false)} className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={(e) => {
                e.preventDefault();
                addMutation.mutate(addFormData);
              }} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Hostname */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hostname / Instance Name</label>
                    <input 
                      type="text" 
                      required
                      className="input-field w-full py-2.5 text-sm" 
                      placeholder="e.g. web-prod-01"
                      value={addFormData.hostname}
                      onChange={e => setAddFormData({...addFormData, hostname: e.target.value})}
                    />
                  </div>

                  {/* Environment */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Environment</label>
                    <select 
                      className="input-field w-full py-2.5 text-sm"
                      value={addFormData.environment}
                      onChange={e => setAddFormData({...addFormData, environment: e.target.value})}
                    >
                      <option value="Production">Production</option>
                      <option value="Staging">Staging</option>
                      <option value="Development">Development</option>
                    </select>
                  </div>

                  {/* OS Template */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">OS Template</label>
                    <select 
                      className="input-field w-full py-2.5 text-sm"
                      value={addFormData.osTemplate}
                      onChange={e => setAddFormData({...addFormData, osTemplate: e.target.value})}
                    >
                      {osTemplates?.map(os => (
                        <option key={os.id} value={os.name}>{os.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* IP Address */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">IP Address</label>
                    <input 
                      type="text" 
                      className="input-field w-full py-2.5 text-sm" 
                      placeholder="e.g. 192.168.1.50"
                      value={addFormData.ipAddress}
                      onChange={e => setAddFormData({...addFormData, ipAddress: e.target.value})}
                    />
                  </div>
                </div>

                {/* Specs */}
                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-50">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">vCPU Cores</label>
                    <input 
                      type="number" 
                      required
                      className="input-field w-full py-2.5 text-sm" 
                      value={addFormData.cpu}
                      onChange={e => setAddFormData({...addFormData, cpu: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">RAM (GB)</label>
                    <input 
                      type="number" 
                      required
                      className="input-field w-full py-2.5 text-sm" 
                      value={addFormData.ram}
                      onChange={e => setAddFormData({...addFormData, ram: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Disk (GB)</label>
                    <input 
                      type="number" 
                      required
                      className="input-field w-full py-2.5 text-sm" 
                      value={addFormData.disk}
                      onChange={e => setAddFormData({...addFormData, disk: parseInt(e.target.value) || 0})}
                    />
                  </div>
                </div>

                {/* SSH credentials */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-50">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">SSH Username</label>
                    <input 
                      type="text" 
                      className="input-field w-full py-2.5 text-sm" 
                      value={addFormData.sshUser}
                      onChange={e => setAddFormData({...addFormData, sshUser: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">SSH Password</label>
                    <input 
                      type="password" 
                      className="input-field w-full py-2.5 text-sm" 
                      placeholder="••••••••"
                      value={addFormData.sshPassword}
                      onChange={e => setAddFormData({...addFormData, sshPassword: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">SSH Port</label>
                    <input 
                      type="number" 
                      className="input-field w-full py-2.5 text-sm" 
                      value={addFormData.sshPort}
                      onChange={e => setAddFormData({...addFormData, sshPort: parseInt(e.target.value) || 22})}
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1.5 pt-4 border-t border-slate-50">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Additional Notes</label>
                  <textarea 
                    rows={3}
                    className="input-field w-full py-2.5 text-sm resize-none" 
                    placeholder="Provisioning details, special usage note..."
                    value={addFormData.notes}
                    onChange={e => setAddFormData({...addFormData, notes: e.target.value})}
                  />
                </div>

                <div className="pt-6 border-t border-slate-50 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="w-1/2 py-3 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold text-sm text-slate-600 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={addMutation.isPending}
                    className="w-1/2 btn-primary flex items-center justify-center gap-2"
                  >
                    {addMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>Save VM</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCopied && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl z-[300] flex items-center gap-3 border border-white/10"
          >
            <Check className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-widest">Copied to clipboard</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

