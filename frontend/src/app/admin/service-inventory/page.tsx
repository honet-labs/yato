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
  Layers,
  Lock,
  ShieldCheck,
  Users
} from "lucide-react";
import { exportToCSV } from "@/lib/csvHelper";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/hooks/useIsAdmin";


interface ServiceInventory {
  id: string;
  serviceName: string;
  version: string;
  environment: string;
  endpoint: string;
  status: string;
  requestedBy?: string;
  ticketId?: string;
  address?: string;
  port?: number;
  username?: string;
  password?: string;
  createdAt: string;
}

export default function GlobalServiceAssetsPage() {
  const queryClient = useQueryClient();
  const { isAdmin, isLoading: isProfileLoading } = useIsAdmin();
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState(null as string | null);
  const [viewingDetails, setViewingDetails] = useState(null as ServiceInventory | null);

  const { data: inventory, isLoading } = useQuery({
    queryKey: ["service-inventory-all"],
    queryFn: async () => {
      const response = await api.get("/service-inventory?scope=all");
      return response.data;
    },
  });

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExport = () => {
    if (!filteredInventory) return;
    const exportData = filteredInventory.map(item => ({
      'Ticket ID': item.ticketId,
      'Service Name': item.serviceName,
      'Version': item.version,
      'Environment': item.environment,
      'Endpoint': item.endpoint,
      'Address': item.address,
      'Port': item.port,
      'Status': item.status,
      'Owner': item.requestedBy,
      'Created At': new Date(item.createdAt).toLocaleString()
    }));
    exportToCSV(exportData, 'YATO_Global_Service_Assets');
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  const filteredInventory = inventory?.filter(item => 
    item.serviceName.toLowerCase().includes(search.toLowerCase()) ||
    item.endpoint?.toLowerCase().includes(search.toLowerCase()) ||
    item.requestedBy?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const totalPages = Math.ceil(filteredInventory.length / itemsPerPage);
  const paginatedInventory = filteredInventory.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (isProfileLoading || isLoading) {
    return (
      <div className="flex min-h-screen bg-slate-950 text-white items-center justify-center p-6">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto" />
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading Service Assets...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen bg-slate-950 text-white items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-20 h-20 bg-rose-500/10 rounded-full border border-rose-500/30 flex items-center justify-center mx-auto mb-6 text-rose-500">
            <Lock className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Access Denied</h2>
          <p className="text-sm text-slate-400">You must hold administrative privileges to access Global Service Assets.</p>
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
                <PageHeader title="Global Service Assets" subtitle="Full registry of provisioned services and endpoints across all teams" />
              </div>
              <div className="flex gap-3 ml-auto">
                <div className="relative group">
                  <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                  <input 
                    type="text" 
                    className="bg-white border border-slate-200 rounded-xl pl-11 pr-4 py-2.5 text-sm w-64 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all" 
                    placeholder="Search service or owner..." 
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
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Service Details</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">URL</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">Environment</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Owner / Team</th>
                      <th className="px-6 py-4 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {isLoading ? (
                      [...Array(5)].map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          <td colSpan={6} className="px-6 py-8 h-20 bg-slate-50/30"></td>
                        </tr>
                      ))
                    ) : paginatedInventory?.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-[11px]">
                          No services found in the global registry.
                        </td>
                      </tr>
                    ) : paginatedInventory?.map((item: any) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100 group-hover:text-amber-600 group-hover:border-amber-100 transition-all shadow-sm">
                              <Layers className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-[14px]">{item.serviceName}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight italic">Asset ID: {item.ticketId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-6">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              {item.endpoint ? (
                                <>
                                  <a 
                                    href={item.endpoint.startsWith('http') ? item.endpoint : `http://${item.endpoint}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-[11px] font-mono text-blue-600 hover:text-blue-700 hover:underline bg-blue-50/50 px-2 py-0.5 rounded border border-blue-100 transition-all flex items-center gap-1.5"
                                  >
                                    {item.endpoint}
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                  <button 
                                    onClick={() => handleCopy(item.endpoint, item.id + '-endpoint')}
                                    className="p-1.5 text-slate-300 hover:text-emerald-600 transition-all"
                                  >
                                    {copiedId === (item.id + '-endpoint') ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                  </button>
                                </>
                              ) : (
                                <span className="text-slate-400 font-mono">N/A</span>
                              )}
                            </div>
                            {item.address && (
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">IP Address:</span>
                                <code className="text-[10px] font-mono text-slate-500">{item.address}:{item.port}</code>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-6 text-center">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-widest border shadow-sm",
                            item.environment?.toUpperCase() === 'PRODUCTION' ? "bg-rose-50 text-rose-600 border-rose-100" :
                            item.environment?.toUpperCase() === 'STAGING' ? "bg-blue-50 text-blue-600 border-blue-100" :
                            "bg-slate-50 text-slate-600 border-slate-100"
                          )}>
                            <div className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              item.environment?.toUpperCase() === 'PRODUCTION' ? "bg-rose-500" :
                              item.environment?.toUpperCase() === 'STAGING' ? "bg-blue-500" :
                              "bg-slate-400"
                            )} />
                            {item.environment?.toUpperCase() === 'PRODUCTION' ? 'PRODUCTION (DC)' : (item.environment || 'DEVELOPMENT')}
                          </span>
                        </td>
                        <td className="px-6 py-6">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
                              {item.requestedBy?.charAt(0) || 'U'}
                            </div>
                            <div>
                              <p className="text-[13px] font-bold text-slate-900">{item.requestedBy || 'Unknown'}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter italic">Provisioned Asset</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-6 text-right">
                          <button 
                            onClick={() => setViewingDetails(item)}
                            className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="View Credentials"
                          >
                            <Lock className="w-4 h-4" />
                          </button>
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
        {viewingDetails && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-white/20"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-xl shadow-indigo-600/20">
                    <ShieldCheck className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">Access Credentials</h3>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">{viewingDetails.serviceName}</p>
                  </div>
                </div>
                <button onClick={() => setViewingDetails(null)} className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="grid grid-cols-1 gap-5">
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Owner Information</span>
                    <p className="text-sm font-bold text-slate-900">{viewingDetails.requestedBy}</p>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">URL</span>
                      <button 
                        onClick={() => handleCopy(viewingDetails.endpoint || '', 'detail-endpoint')}
                        className="text-indigo-600 hover:text-indigo-700 font-bold text-[10px] uppercase tracking-widest flex items-center gap-1"
                      >
                        {copiedId === 'detail-endpoint' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        Copy URL
                      </button>
                    </div>
                    <a 
                      href={viewingDetails.endpoint?.startsWith('http') ? viewingDetails.endpoint : `http://${viewingDetails.endpoint}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-mono text-blue-600 hover:underline flex items-center gap-2 group"
                    >
                      {viewingDetails.endpoint || 'Not available'}
                      {viewingDetails.endpoint && <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />}
                    </a>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <UserIcon className="w-4 h-4 text-slate-400" />
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Username</span>
                          <span className="text-sm font-mono text-slate-900">{viewingDetails.username || '---'}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleCopy(viewingDetails.username || '', 'detail-user')}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                      >
                        {copiedId === 'detail-user' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <div className="h-px bg-slate-200/50 mx-[-1.25rem]" />

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Lock className="w-4 h-4 text-slate-400" />
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Password</span>
                          <span className="text-sm font-mono text-slate-900">
                            {viewingDetails.password ? '••••••••' : '---'}
                          </span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleCopy(viewingDetails.password || '', 'detail-pass')}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                      >
                        {copiedId === 'detail-pass' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
