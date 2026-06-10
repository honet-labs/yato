"use client";
import { PageHeader } from "@/components/PageHeader";

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
  Download
} from "lucide-react";
import { exportToCSV } from "@/lib/csvHelper";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
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
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  
  // Modals
  const [showConsole, setShowConsole] = useState<VM | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const terminateMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/vm-inventory/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vm-inventory"] });
      setActiveMenu(null);
    },
  });


  
  const { data: userProfile } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const response = await api.get("/auth/profile");
      return response.data;
    },
  });

  const isAdmin = userProfile?.roles?.some((r: any) => r.role.name === 'ADMIN' || r.role.name === 'SUPERADMIN');

  const { data: inventory, isLoading } = useQuery<VM[]>({
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

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
              <div className="flex gap-3 ml-auto">
                <div className="relative group">
                  <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                  <input 
                    type="text" 
                    className="bg-white border border-slate-200 rounded-xl pl-11 pr-4 py-2.5 text-sm w-64 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all" 
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
            </header>

            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-visible">
              <div className="overflow-x-auto md:overflow-x-visible min-h-[400px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Instance Details</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Configuration</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">Network</th>
                      {isAdmin && (
                        <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Owner</th>
                      )}
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">Environment</th>
                      <th className="px-6 py-4 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {isLoading ? (
                      [...Array(3)].map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          <td colSpan={5} className="px-6 py-8 h-20 bg-slate-50/30"></td>
                        </tr>
                      ))
                    ) : paginatedInventory?.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-20 text-center text-slate-400 font-medium">
                          No active instances found.
                        </td>
                      </tr>
                    ) : paginatedInventory?.map((vm) => (
                      <tr key={vm.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 shadow-sm">
                              <Monitor className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-[14px]">{vm.hostname}</p>
                              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">{vm.os || 'Ubuntu 22.04 LTS'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-6">
                          <div className="flex items-center gap-5">
                            <div className="flex items-center gap-1.5">
                              <Cpu className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-[12px] font-bold text-slate-600 uppercase">CPU: {vm.cpu} CORE</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Database className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-[12px] font-bold text-slate-600 uppercase">RAM: {vm.ram}GB</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-[12px] font-bold text-slate-600 uppercase">STORAGE: {vm.disk}GB</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-6 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg group hover:border-blue-200 transition-all cursor-pointer">
                              <span className="font-mono text-[11px] font-bold text-slate-600 group-hover:text-blue-600">{vm.ip || 'Pending...'}</span>
                            </div>
                            {vm.ip && (
                              <button 
                                onClick={() => copyToClipboard(vm.ip)}
                                className="p-1.5 hover:bg-slate-50 rounded-md text-slate-400 hover:text-blue-600 transition-all border border-transparent hover:border-slate-100"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                        {isAdmin && (
                          <td className="px-6 py-6">
                            <div className="flex flex-col gap-0.5">
                              <span className="flex items-center gap-1.5 text-[13px] font-bold text-slate-900">
                                <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                                {vm.requestedBy || 'Unknown'}
                              </span>
                              <p className="text-[10px] text-slate-400 font-bold truncate max-w-[150px]">{vm.notes || 'No notes'}</p>
                            </div>
                          </td>
                        )}
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

                          <AnimatePresence>
                            {activeMenu === vm.id && (
                              <motion.div 
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                className="absolute right-6 top-[80%] w-48 bg-white rounded-xl shadow-2xl border border-slate-100 p-2 z-[100]"
                              >
                                <button 
                                  onClick={() => { setShowConsole(vm); setActiveMenu(null); }}
                                  className="w-full flex items-center gap-3 px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-lg transition-all"
                                >
                                  <Terminal className="w-4 h-4" />
                                  CONSOLE ACCESS
                                </button>

                                <div className="h-px bg-slate-50 my-1" />
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
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
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
                <button onClick={() => setShowConsole(null)} className="text-white/40 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-8 space-y-8">
                <div className="font-mono text-[13px] text-emerald-400/90 space-y-2 bg-black/40 p-6 rounded-xl border border-white/5 shadow-inner">
                  <p className="text-white/40 mb-4 tracking-tighter"># System established {new Date().toLocaleString()}</p>
                  <p>$ ssh {showConsole.sshUser || 'root'}@{showConsole.ip || 'pending'} -p {showConsole.sshPort || 22}</p>
                  <p className="animate-pulse">Authenticating with encrypted keys...</p>
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
                        <span className="text-[13px] font-bold text-white">{showConsole.sshUser || 'root'}</span>
                        <button onClick={() => copyToClipboard(showConsole.sshUser || 'root')} className="text-white/20 hover:text-white">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Password</p>
                      <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                        <span className="text-[13px] font-bold text-white">••••••••••••</span>
                        <button onClick={() => copyToClipboard(showConsole.sshPassword || '')} className="text-white/20 hover:text-white">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
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

