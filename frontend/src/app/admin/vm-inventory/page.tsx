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
  Settings, 
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
  Users
} from "lucide-react";
import { exportToCSV } from "@/lib/csvHelper";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Lock } from "lucide-react";


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

export default function GlobalVmInventoryPage() {
  const queryClient = useQueryClient();
  const { isAdmin, permissions, isLoading: isProfileLoading } = useIsAdmin();
  const canView = isAdmin || permissions.includes("MANAGE_VM_INVENTORY");
  const [search, setSearch] = useState("");
  const [activeMenu, setActiveMenu] = useState(null as string | null);
  const [isCopied, setIsCopied] = useState(false);

  const { data: inventory, isLoading } = useQuery({
    queryKey: ["vm-inventory-all"],
    queryFn: async () => {
      const response = await api.get("/vm-inventory?scope=all");
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
    exportToCSV(exportData, 'YATO_Global_VM_Inventory');
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  const filteredInventory = inventory?.filter(vm => 
    vm.hostname.toLowerCase().includes(search.toLowerCase()) ||
    vm.ip?.toLowerCase().includes(search.toLowerCase()) ||
    vm.requestedBy?.toLowerCase().includes(search.toLowerCase())
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

  if (isProfileLoading || isLoading) {
    return (
      <div className="flex min-h-screen bg-white items-center justify-center p-6">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto" />
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading VM Assets...</p>
        </div>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="flex min-h-screen bg-white items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-20 h-20 bg-rose-50 rounded-full border border-rose-200 flex items-center justify-center mx-auto mb-6 text-rose-500">
            <Lock className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">Access Denied</h2>
          <p className="text-sm text-slate-400">You must hold appropriate permissions to access Global VM Inventory.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        <MobileNav />
        <main className="page-container overflow-y-auto custom-scrollbar p-8 flex-1">
          <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <PageHeader title="Global VM Inventory" subtitle="Management view of all virtual infrastructure across the organization" />
              </div>
              <div className="flex gap-3 ml-auto">
                <div className="relative group">
                  <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                  <input 
                    type="text" 
                    className="bg-white border border-slate-200 rounded-xl pl-11 pr-4 py-2.5 text-sm w-64 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all" 
                    placeholder="Search by host or owner..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <button 
                  onClick={handleExport}
                  className="bg-white border border-slate-200 text-slate-600 px-6 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>
            </header>

            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-visible">
              <div className="overflow-x-auto min-h-[400px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Instance Details</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Configuration</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">Network</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Owner / Department</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">Environment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {isLoading ? (
                      [...Array(5)].map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          <td colSpan={5} className="px-6 py-8 h-20 bg-slate-50/30"></td>
                        </tr>
                      ))
                    ) : paginatedInventory?.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-20 text-center text-slate-400 font-medium font-bold uppercase tracking-widest text-[11px]">
                          No infrastructure assets found matching your criteria.
                        </td>
                      </tr>
                    ) : paginatedInventory?.map((vm: any) => (
                      <tr key={vm.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100 group-hover:text-indigo-600 group-hover:border-indigo-100 transition-all">
                              <Monitor className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-[14px]">{vm.hostname}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{vm.os || 'Ubuntu 22.04 LTS'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-6">
                          <div className="flex items-center gap-4">
                            <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded uppercase">CPU: {vm.cpu} Core</span>
                            <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded uppercase">RAM: {vm.ram}GB</span>
                            <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded uppercase">Storage: {vm.disk}GB</span>
                          </div>
                        </td>
                        <td className="px-6 py-6 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <code className="text-[11px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-100">
                              {vm.ip || '0.0.0.0'}
                            </code>
                            <button onClick={() => copyToClipboard(vm.ip)} className="p-1.5 text-slate-300 hover:text-indigo-600 transition-colors">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-6">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
                              {vm.requestedBy?.charAt(0) || 'U'}
                            </div>
                            <div>
                              <p className="text-[13px] font-bold text-slate-900">{vm.requestedBy || 'Unknown'}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter italic truncate max-w-[120px]">{vm.notes || 'Asset Registry'}</p>
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

      <AnimatePresence>
        {isCopied && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl z-[300] flex items-center gap-3 border border-white/10"
          >
            <Check className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-[11px]">Success: Copied to clipboard</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
